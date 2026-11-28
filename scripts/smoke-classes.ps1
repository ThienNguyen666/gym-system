$base = 'http://localhost:3000/api'
$pass = 'Passw0rd!'
$script:fail = 0

function Call($method, $path, $body = $null, $token = $null) {
  $p = @{ Method = $method; Uri = "$base$path"; ContentType = 'application/json'; UseBasicParsing = $true }
  if ($token) { $p.Headers = @{ Authorization = "Bearer $token" } }
  if ($body)  { $p.Body = ($body | ConvertTo-Json) }
  try {
    $r = Invoke-WebRequest @p
    $b = $null; if ($r.Content) { $b = $r.Content | ConvertFrom-Json }
    return @{ status = [int]$r.StatusCode; body = $b }
  } catch {
    $err = $_
    $b = $null; $txt = $null
    try { $txt = (New-Object IO.StreamReader($err.Exception.Response.GetResponseStream())).ReadToEnd() } catch {}
    if (-not $txt -and $err.ErrorDetails) { $txt = $err.ErrorDetails.Message }
    if ($txt) { try { $b = $txt | ConvertFrom-Json } catch {} }
    return @{ status = [int]$err.Exception.Response.StatusCode; body = $b }
  }
}
function Check($name, $actual, $expected) {
  if ($actual -eq $expected) { Write-Host "PASS  $name" -ForegroundColor Green }
  else { Write-Host "FAIL  $name (got $actual, expected $expected)" -ForegroundColor Red; $script:fail++ }
}
function Login($email, $pw = $pass) { Call POST '/auth/login' @{ email = $email; password = $pw } }
# Đổi "giờ h:m giờ Việt Nam của ngày $date" sang chuỗi ISO UTC
function VNIso($date, $h, $m = 0) {
  $date.AddHours($h - 7).AddMinutes($m).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [Globalization.CultureInfo]::InvariantCulture)
}

$mgr = Login 'manager@gym.local';  $mt  = $mgr.body.accessToken
$adm = Login 'admin@gym.local';    $at  = $adm.body.accessToken
$m1  = Login 'member1@gym.local';  $t1  = $m1.body.accessToken
$tr1 = Login 'trainer1@gym.local'; $tt1 = $tr1.body.accessToken
$none = '00000000-0000-4000-8000-000000000000'

$d  = (Get-Date).ToUniversalTime().AddHours(7).Date.AddDays(7)   # ngày VN, 7 ngày nữa
$d2 = $d.AddDays(1)
$dow = [int]$d.DayOfWeek; $dow2 = [int]$d2.DayOfWeek

Write-Host '--- Trainers ---'
$temail = "qt$(Get-Random)@gym.local"
$nt = Call POST '/trainers' @{ email = $temail; fullName = 'QA Trainer'; password = $pass; specialization = 'Yoga' } $mt
Check 'manager tạo HLV' $nt.status 201
$qid = $nt.body.id
Check 'tạo trùng email -> 409' (Call POST '/trainers' @{ email = $temail; fullName = 'x'; password = $pass } $mt).status 409
Check 'mật khẩu ngắn -> 400' (Call POST '/trainers' @{ email = "b$temail"; fullName = 'x'; password = '123' } $mt).status 400
Check 'admin tạo HLV -> 403' (Call POST '/trainers' @{ email = "c$temail"; fullName = 'x'; password = $pass } $at).status 403
Check 'member tạo HLV -> 403' (Call POST '/trainers' @{ email = "d$temail"; fullName = 'x'; password = $pass } $t1).status 403
$qt = Login $temail; $qtt = $qt.body.accessToken
Check 'HLV mới đăng nhập' $qt.status 200
$lm = Call GET '/trainers' $null $t1
Check 'member xem danh sách HLV' $lm.status 200
Check 'member không thấy email HLV' ($null -eq @($lm.body)[0].email) $true
Check 'manager thấy email HLV' ($null -ne @((Call GET '/trainers' $null $mt).body)[0].email) $true
Check 'member xem 1 HLV' (Call GET "/trainers/$qid" $null $t1).status 200
Check 'HLV không tồn tại -> 404' (Call GET "/trainers/$none" $null $mt).status 404
Check 'id hội viên không phải HLV -> 404' (Call GET "/trainers/$($m1.body.user.id)" $null $mt).status 404
Check 'manager sửa HLV' (Call PATCH "/trainers/$qid" @{ specialization = 'HIIT' } $mt).status 200
Check 'HLV tự sửa hồ sơ -> 403' (Call PATCH "/trainers/$qid" @{ specialization = 'x' } $qtt).status 403
Check 'manager khóa HLV' (Call PATCH "/trainers/$qid/status" @{ status = 'disabled' } $mt).status 200
Check 'HLV bị khóa login -> 403' (Login $temail).status 403
Check 'manager mở khóa HLV' (Call PATCH "/trainers/$qid/status" @{ status = 'active' } $mt).status 200
$qt = Login $temail; $qtt = $qt.body.accessToken

Write-Host '--- Khung giờ rảnh ---'
$s1 = Call POST "/trainers/$qid/availability" @{ dayOfWeek = $dow; startTime = '07:00'; endTime = '12:00' } $qtt
Check 'HLV khai báo khung giờ' $s1.status 201
Check 'khung giờ trùng -> 409' (Call POST "/trainers/$qid/availability" @{ dayOfWeek = $dow; startTime = '11:00'; endTime = '13:00' } $qtt).status 409
Check 'giờ kết thúc <= bắt đầu -> 400' (Call POST "/trainers/$qid/availability" @{ dayOfWeek = $dow; startTime = '15:00'; endTime = '14:00' } $qtt).status 400
Check 'sai định dạng giờ -> 400' (Call POST "/trainers/$qid/availability" @{ dayOfWeek = $dow; startTime = '7:00'; endTime = '9:00' } $qtt).status 400
Check 'dayOfWeek = 7 -> 400' (Call POST "/trainers/$qid/availability" @{ dayOfWeek = 7; startTime = '07:00'; endTime = '09:00' } $qtt).status 400
Check 'manager khai báo hộ -> 403' (Call POST "/trainers/$qid/availability" @{ dayOfWeek = $dow2; startTime = '07:00'; endTime = '09:00' } $mt).status 403
Check 'HLV khác khai báo hộ -> 403' (Call POST "/trainers/$qid/availability" @{ dayOfWeek = $dow2; startTime = '07:00'; endTime = '09:00' } $tt1).status 403
Check 'manager xem khung giờ' (Call GET "/trainers/$qid/availability" $null $mt).status 200
Check 'HLV khác xem khung giờ -> 403' (Call GET "/trainers/$qid/availability" $null $tt1).status 403
Check 'member xem khung giờ -> 403' (Call GET "/trainers/$qid/availability" $null $t1).status 403
Check 'HLV sửa khung giờ' (Call PATCH "/trainers/$qid/availability/$($s1.body.id)" @{ endTime = '12:30' } $qtt).status 200
Check 'sửa giờ kết thúc trước bắt đầu -> 400' (Call PATCH "/trainers/$qid/availability/$($s1.body.id)" @{ endTime = '06:00' } $qtt).status 400
$s2 = Call POST "/trainers/$qid/availability" @{ dayOfWeek = $dow2; startTime = '06:00'; endTime = '08:00' } $qtt
Check 'thêm khung giờ ngày khác' $s2.status 201
Check 'xóa khung giờ' (Call DELETE "/trainers/$qid/availability/$($s2.body.id)" $null $qtt).status 204
Check 'xóa lần 2 -> 404' (Call DELETE "/trainers/$qid/availability/$($s2.body.id)" $null $qtt).status 404

Write-Host '--- Classes + BR9 ---'
$c0 = Call POST '/classes' @{ title = 'QA no trainer'; startTime = (VNIso $d 8); endTime = (VNIso $d 9); capacity = 10 } $mt
Check 'tạo lớp chưa phân công' $c0.status 201
Check 'spotsLeft = capacity' $c0.body.spotsLeft 10
Check 'member tạo lớp -> 403' (Call POST '/classes' @{ title = 'x'; startTime = (VNIso $d 8); endTime = (VNIso $d 9); capacity = 10 } $t1).status 403
Check 'HLV tạo lớp -> 403' (Call POST '/classes' @{ title = 'x'; startTime = (VNIso $d 8); endTime = (VNIso $d 9); capacity = 10 } $tt1).status 403
Check 'kết thúc trước bắt đầu -> 400' (Call POST '/classes' @{ title = 'x'; startTime = (VNIso $d 9); endTime = (VNIso $d 8); capacity = 10 } $mt).status 400
Check 'sức chứa 0 -> 400' (Call POST '/classes' @{ title = 'x'; startTime = (VNIso $d 8); endTime = (VNIso $d 9); capacity = 0 } $mt).status 400
Check 'lớp ở quá khứ -> 400' (Call POST '/classes' @{ title = 'x'; startTime = (VNIso $d.AddDays(-30) 8); endTime = (VNIso $d.AddDays(-30) 9); capacity = 10 } $mt).status 400
Check 'lớp qua nửa đêm -> 400' (Call POST '/classes' @{ title = 'x'; startTime = (VNIso $d 23); endTime = (VNIso $d 25); capacity = 10 } $mt).status 400
Check 'trainerId không tồn tại -> 404' (Call POST '/classes' @{ title = 'x'; startTime = (VNIso $d 8); endTime = (VNIso $d 9); capacity = 10; trainerId = $none } $mt).status 404

$cA = Call POST '/classes' @{ title = 'QA A'; startTime = (VNIso $d 8); endTime = (VNIso $d 9); capacity = 10; trainerId = $qid } $mt
Check 'tạo lớp trong khung giờ rảnh' $cA.status 201
$ex = Call POST '/classes' @{ title = 'QA out'; startTime = (VNIso $d 13); endTime = (VNIso $d 14); capacity = 10; trainerId = $qid } $mt
Check 'ngoài khung giờ -> 409' $ex.status 409
Check 'type = outside_availability' $ex.body.type 'outside_availability'
$ov = Call POST '/classes' @{ title = 'QA ov'; startTime = (VNIso $d 8 30); endTime = (VNIso $d 9 30); capacity = 10; trainerId = $qid } $mt
Check 'trùng giờ -> 409' $ov.status 409
Check 'type = overlap' $ov.body.type 'overlap'
Check 'conflictClass là lớp A' $ov.body.conflictClass.id $cA.body.id
$cB = Call POST '/classes' @{ title = 'QA B'; startTime = (VNIso $d 9); endTime = (VNIso $d 10); capacity = 10; trainerId = $qid } $mt
Check 'lớp liền kề (kết thúc = bắt đầu) không tính trùng' $cB.status 201
Check 'ngày không có khung giờ -> 409' (Call POST '/classes' @{ title = 'x'; startTime = (VNIso $d2 8); endTime = (VNIso $d2 9); capacity = 10; trainerId = $qid } $mt).status 409

Write-Host '--- Phân công HLV ---'
Check 'phân công vào lớp trùng giờ -> 409' (Call PUT "/classes/$($c0.body.id)/trainer" @{ trainerId = $qid } $mt).status 409
Check 'phân công HLV không tồn tại -> 404' (Call PUT "/classes/$($c0.body.id)/trainer" @{ trainerId = $none } $mt).status 404
Check 'phân công id hội viên -> 404' (Call PUT "/classes/$($c0.body.id)/trainer" @{ trainerId = $m1.body.user.id } $mt).status 404
Check 'thiếu trainerId -> 400' (Call PUT "/classes/$($c0.body.id)/trainer" @{ x = 1 } $mt).status 400
Check 'member phân công -> 403' (Call PUT "/classes/$($c0.body.id)/trainer" @{ trainerId = $qid } $t1).status 403
$cC = Call POST '/classes' @{ title = 'QA C'; startTime = (VNIso $d 11); endTime = (VNIso $d 12); capacity = 10 } $mt
$as = Call PUT "/classes/$($cC.body.id)/trainer" @{ trainerId = $qid } $mt
Check 'phân công hợp lệ' $as.status 200
Check 'lớp mang đúng HLV' $as.body.trainer.id $qid
$un = Call PUT "/classes/$($cC.body.id)/trainer" @{ trainerId = $null } $mt
Check 'bỏ phân công (null)' $un.status 200
Check 'trainer = null' ($null -eq $un.body.trainer) $true

Write-Host '--- Sửa lớp ---'
Check 'sửa tên lớp' (Call PATCH "/classes/$($cA.body.id)" @{ title = 'QA A edited' } $mt).status 200
$cap = Call PATCH "/classes/$($cA.body.id)" @{ capacity = 20 } $mt
Check 'tăng sức chứa' $cap.status 200
Check 'spotsLeft cập nhật' $cap.body.spotsLeft 20
Check 'dời A sang 9:30-10:30 trùng B -> 409' (Call PATCH "/classes/$($cA.body.id)" @{ startTime = (VNIso $d 9 30); endTime = (VNIso $d 10 30) } $mt).status 409
Check 'dời A sang 10:00-11:00' (Call PATCH "/classes/$($cA.body.id)" @{ startTime = (VNIso $d 10); endTime = (VNIso $d 11) } $mt).status 200
Check 'member sửa lớp -> 403' (Call PATCH "/classes/$($cA.body.id)" @{ title = 'hack' } $t1).status 403
Check 'sửa lớp không tồn tại -> 404' (Call PATCH "/classes/$none" @{ title = 'x' } $mt).status 404
Check 'id sai định dạng -> 400' (Call PATCH '/classes/abc' @{ title = 'x' } $mt).status 400

Write-Host '--- Xem lịch, lớp của HLV, roster ---'
$qs = "from=$(VNIso $d 0)&to=$(VNIso $d2 0)"
$ls = Call GET "/classes?$qs" $null $t1
Check 'member xem lịch lớp' $ls.status 200
Check 'lịch có lớp A' @(@($ls.body) | Where-Object { $_.id -eq $cA.body.id }).Count 1
Check 'lịch có trường spotsLeft' ($null -ne @($ls.body)[0].spotsLeft) $true
Check 'lọc theo trainerId (A và B)' @((Call GET "/classes?$qs&trainerId=$qid" $null $mt).body).Count 2
Check 'from sai định dạng -> 400' (Call GET '/classes?from=abc' $null $mt).status 400
Check 'chi tiết lớp' (Call GET "/classes/$($cA.body.id)" $null $t1).status 200
Check 'lớp không tồn tại -> 404' (Call GET "/classes/$none" $null $t1).status 404
$tc = Call GET "/trainers/$qid/classes?$qs" $null $qtt
Check 'HLV xem lớp của mình' $tc.status 200
Check 'HLV có đúng 2 lớp' @($tc.body).Count 2
Check 'HLV khác xem lớp -> 403' (Call GET "/trainers/$qid/classes?$qs" $null $tt1).status 403
Check 'manager xem lớp của HLV' (Call GET "/trainers/$qid/classes?$qs" $null $mt).status 200
Check 'member xem lớp HLV -> 403' (Call GET "/trainers/$qid/classes?$qs" $null $t1).status 403
$ro = Call GET "/classes/$($cA.body.id)/roster" $null $mt
Check 'roster: manager' $ro.status 200
Check 'roster rỗng khi chưa có lượt đặt' @($ro.body.roster | Where-Object { $_ }).Count 0
Check 'roster: HLV phụ trách' (Call GET "/classes/$($cA.body.id)/roster" $null $qtt).status 200
Check 'roster: HLV khác -> 403' (Call GET "/classes/$($cA.body.id)/roster" $null $tt1).status 403
Check 'roster: member -> 403' (Call GET "/classes/$($cA.body.id)/roster" $null $t1).status 403

Write-Host '--- Phân công đồng thời (khóa theo HLV) ---'
$cD = Call POST '/classes' @{ title = 'QA D'; startTime = (VNIso $d 11); endTime = (VNIso $d 12); capacity = 10 } $mt
$cE = Call POST '/classes' @{ title = 'QA E'; startTime = (VNIso $d 11 30); endTime = (VNIso $d 12 30); capacity = 10 } $mt
$jobs = foreach ($cid in @($cD.body.id, $cE.body.id)) {
  Start-Job -ArgumentList $cid, $qid, $mt -ScriptBlock {
    param($classId, $trainerId, $tok)
    try {
      $r = Invoke-WebRequest -Method PUT -Uri "http://localhost:3000/api/classes/$classId/trainer" -Headers @{ Authorization = "Bearer $tok" } -ContentType 'application/json' -Body (@{ trainerId = $trainerId } | ConvertTo-Json) -UseBasicParsing
      [string][int]$r.StatusCode
    } catch { [string][int]$_.Exception.Response.StatusCode }
  }
}
$codes = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job
Check 'đúng 1 phân công thành công (200)' @($codes | Where-Object { $_ -eq '200' }).Count 1
Check 'phân công còn lại bị từ chối (409)' @($codes | Where-Object { $_ -eq '409' }).Count 1

Write-Host ''
if ($script:fail -eq 0) { Write-Host 'TẤT CẢ ĐẠT' -ForegroundColor Green } else { Write-Host "$script:fail test FAIL" -ForegroundColor Red }