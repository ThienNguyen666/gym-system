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
function VNIso($date, $h, $m = 0) {
  $date.AddHours($h - 7).AddMinutes($m).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [Globalization.CultureInfo]::InvariantCulture)
}
function NewClass($title, $start, $end, $cap) {
  Call POST '/classes' @{ title = $title; startTime = $start; endTime = $end; capacity = $cap } $script:mt
}
function Book($classId, $token) { Call POST "/classes/$classId/bookings" $null $token }
function NewMember($pkgId) {
  $email = "qb$(Get-Random)@gym.local"
  $m = Call POST '/members' @{ email = $email; fullName = 'QA Booker'; password = $pass } $script:mt
  $res = @{ id = $m.body.id; payId = $null }
  if ($pkgId) {
    $r = Call POST "/members/$($m.body.id)/packages" @{ packageId = $pkgId } $script:mt
    $p = Call POST '/payments' @{ memberPackageId = $r.body.memberPackage.id; amount = 1000; method = 'cash' } $script:mt
    $res.payId = $p.body.payment.id
  }
  $res.token = (Login $email).body.accessToken
  return $res
}
function ActivePkg($memberId) {
  (@((Call GET "/members/$memberId/packages" $null $script:mt).body) | Where-Object { $_.status -eq 'active' })[0]
}
# Bắn song song N yêu cầu đặt lớp, cùng giờ xuất phát; trả về mảng mã HTTP
function ParallelBook($pairs) {
  $startAt = [DateTime]::UtcNow.AddSeconds(3 + 0.7 * @($pairs).Count).Ticks
  $jobs = foreach ($p in $pairs) {
    Start-Job -ArgumentList $p.classId, $p.token, $startAt -ScriptBlock {
      param($cid, $tok, $ticks)
      $go = New-Object DateTime ($ticks, [DateTimeKind]::Utc)
      while ([DateTime]::UtcNow -lt $go) { Start-Sleep -Milliseconds 2 }
      try {
        $r = Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/classes/$cid/bookings" -Headers @{ Authorization = "Bearer $tok" } -ContentType 'application/json' -UseBasicParsing
        [string][int]$r.StatusCode
      } catch { [string][int]$_.Exception.Response.StatusCode }
    }
  }
  $codes = $jobs | Wait-Job | Receive-Job
  $jobs | Remove-Job
  return @($codes)
}
function CountCode($codes, $code) { @($codes | Where-Object { $_ -eq $code }).Count }

$mgr = Login 'manager@gym.local'; $script:mt = $mgr.body.accessToken; $mt = $script:mt
$trn = Login 'trainer1@gym.local'
$adm = Login 'admin@gym.local'
$none = '00000000-0000-4000-8000-000000000000'
$d = (Get-Date).ToUniversalTime().AddHours(7).Date.AddDays(7)

$pk = Call GET '/packages' $null $mt
$monthly = @($pk.body) | Where-Object { $_.type -eq 'duration' -and $_.durationDays -eq 30 } | Select-Object -First 1
$sess2 = Call POST '/packages' @{ name = "QA 2 buoi $(Get-Random)"; type = 'sessions'; price = 1000; totalSessions = 2 } $mt

Write-Host '--- Đặt lớp cơ bản ---'
$A = NewMember $monthly.id; $B = NewMember $monthly.id; $N = NewMember $null
$c1 = NewClass 'QA c1' (VNIso $d 8) (VNIso $d 9) 1
Check 'tạo lớp sức chứa 1' $c1.status 201
$rn = Book $c1.body.id $N.token
Check 'chưa có gói -> 409' $rn.status 409
Check 'type = no_active_package' $rn.body.type 'no_active_package'
Check 'manager đặt lớp -> 403' (Book $c1.body.id $mt).status 403
Check 'admin đặt lớp -> 403' (Book $c1.body.id $adm.body.accessToken).status 403
Check 'trainer đặt lớp -> 403' (Book $c1.body.id $trn.body.accessToken).status 403
Check 'lớp không tồn tại -> 404' (Book $none $A.token).status 404
Check 'id sai định dạng -> 400' (Book 'abc' $A.token).status 400
$b1 = Book $c1.body.id $A.token
Check 'A đặt lớp' $b1.status 201
Check 'trạng thái confirmed' $b1.body.status 'confirmed'
Check 'spotsLeft = 0' $b1.body.spotsLeft 0
$dup = Book $c1.body.id $A.token
Check 'đặt trùng -> 409' $dup.status 409
Check 'type = already_booked' $dup.body.type 'already_booked'
$full = Book $c1.body.id $B.token
Check 'lớp đầy -> 409' $full.status 409
Check 'type = class_full' $full.body.type 'class_full'
Check 'lớp có confirmedCount = 1' (Call GET "/classes/$($c1.body.id)" $null $mt).body.confirmedCount 1
Check 'gói của A giữ 1 chỗ (pendingCount = 1)' (ActivePkg $A.id).pendingCount 1

Write-Host '--- Mã QR ---'
$qr = Call GET "/bookings/$($b1.body.id)/qr" $null $A.token
Check 'A lấy QR' $qr.status 200
Check 'QR là ảnh PNG' ($qr.body.qrDataUrl.StartsWith('data:image/png;base64,')) $true
Check 'payload có tiền tố GYM-BK:' ($qr.body.payload.StartsWith('GYM-BK:')) $true
Check 'QR của người khác -> 403' (Call GET "/bookings/$($b1.body.id)/qr" $null $B.token).status 403
Check 'manager lấy QR -> 403' (Call GET "/bookings/$($b1.body.id)/qr" $null $mt).status 403

Write-Host '--- Hủy lượt đặt ---'
Check 'B hủy lượt của A -> 403' (Call DELETE "/bookings/$($b1.body.id)" $null $B.token).status 403
Check 'trainer hủy -> 403' (Call DELETE "/bookings/$($b1.body.id)" $null $trn.body.accessToken).status 403
Check 'id không tồn tại -> 404' (Call DELETE "/bookings/$none" $null $A.token).status 404
$cn = Call DELETE "/bookings/$($b1.body.id)" $null $A.token
Check 'A hủy lượt của mình' $cn.status 200
Check 'trạng thái cancelled' $cn.body.status 'cancelled'
$cn2 = Call DELETE "/bookings/$($b1.body.id)" $null $A.token
Check 'hủy lần 2 -> 409' $cn2.status 409
Check 'type = not_confirmed' $cn2.body.type 'not_confirmed'
Check 'lớp trả lại chỗ (confirmedCount = 0)' (Call GET "/classes/$($c1.body.id)" $null $mt).body.confirmedCount 0
Check 'gói trả lại chỗ giữ (pendingCount = 0)' (ActivePkg $A.id).pendingCount 0
Check 'QR của lượt đã hủy -> 409' (Call GET "/bookings/$($b1.body.id)/qr" $null $A.token).status 409
Check 'B đặt được chỗ vừa trả' (Book $c1.body.id $B.token).status 201

$c2 = NewClass 'QA c2' (VNIso $d 9) (VNIso $d 10) 5
$x1 = Book $c2.body.id $A.token
Check 'A đặt c2' $x1.status 201
Check 'A hủy c2' (Call DELETE "/bookings/$($x1.body.id)" $null $A.token).status 200
Check 'A đặt lại c2 sau khi hủy' (Book $c2.body.id $A.token).status 201

Write-Host '--- BR2(b): gói hết hiệu lực vào ngày học ---'
$cFar = NewClass 'QA far' (VNIso $d.AddDays(33) 8) (VNIso $d.AddDays(33) 9) 5
$far = Book $cFar.body.id $B.token
Check 'lớp sau ngày hết hạn gói -> 409' $far.status 409
Check 'type = package_not_valid_on_class_date' $far.body.type 'package_not_valid_on_class_date'

Write-Host '--- Gói theo số buổi (I2) tuần tự ---'
$S = NewMember $sess2.body.id
$k1 = NewClass 'QA k1' (VNIso $d 10) (VNIso $d 11) 5
$k2 = NewClass 'QA k2' (VNIso $d 11) (VNIso $d 12) 5
$k3 = NewClass 'QA k3' (VNIso $d 12) (VNIso $d 13) 5
$sb1 = Book $k1.body.id $S.token
Check 'S đặt k1' $sb1.status 201
Check 'S đặt k2' (Book $k2.body.id $S.token).status 201
$sx = Book $k3.body.id $S.token
Check 'gói 2 buổi: đặt lớp thứ 3 -> 409' $sx.status 409
Check 'type = sessions_exhausted' $sx.body.type 'sessions_exhausted'
Check 'lớp k3 không bị tăng bộ đếm (rollback)' (Call GET "/classes/$($k3.body.id)" $null $mt).body.confirmedCount 0
Check 'pendingCount = 2' (ActivePkg $S.id).pendingCount 2
Check 'S hủy k1' (Call DELETE "/bookings/$($sb1.body.id)" $null $S.token).status 200
Check 'pendingCount = 1' (ActivePkg $S.id).pendingCount 1
Check 'S đặt được k3 sau khi nhả chỗ' (Book $k3.body.id $S.token).status 201

Write-Host '--- Hoàn tiền bị chặn khi còn lượt đặt ---'
$R = NewMember $monthly.id
$cR = NewClass 'QA refund' (VNIso $d 15) (VNIso $d 16) 5
$rb = Book $cR.body.id $R.token
Check 'R đặt lớp' $rb.status 201
Check 'hoàn tiền khi còn lượt đặt -> 409' (Call POST "/payments/$($R.payId)/refund" $null $mt).status 409
Check 'R hủy lượt đặt' (Call DELETE "/bookings/$($rb.body.id)" $null $R.token).status 200
Check 'hoàn tiền sau khi hủy' (Call POST "/payments/$($R.payId)/refund" $null $mt).status 200
$rr = Book $cR.body.id $R.token
Check 'gói đã hoàn tiền không đặt được lớp -> 409' $rr.status 409
Check 'type = no_active_package' $rr.body.type 'no_active_package'

Write-Host '--- Hạn hủy BR4 ---'
$nowVN = (Get-Date).ToUniversalTime().AddHours(7)
if ($nowVN.Hour -lt 22) {
  $iso = [Globalization.CultureInfo]::InvariantCulture
  $nStart = (Get-Date).ToUniversalTime().AddHours(1).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", $iso)
  $nEnd   = (Get-Date).ToUniversalTime().AddHours(1.5).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", $iso)
  $cNear = NewClass 'QA near' $nStart $nEnd 5
  Check 'tạo lớp sắp diễn ra (còn 1 giờ)' $cNear.status 201
  $C = NewMember $monthly.id
  $nb = Book $cNear.body.id $C.token
  Check 'C đặt lớp sắp diễn ra' $nb.status 201
  $late = Call DELETE "/bookings/$($nb.body.id)" $null $C.token
  Check 'hội viên hủy sau hạn -> 409' $late.status 409
  Check 'type = cancel_window_closed' $late.body.type 'cancel_window_closed'
  Check 'manager hủy thay sau hạn' (Call DELETE "/bookings/$($nb.body.id)" $null $mt).status 200
} else { Write-Host 'BỎ QUA: sau 22:00 giờ VN không tạo được lớp trong cùng ngày' -ForegroundColor Yellow }

Write-Host '--- Lịch sử đặt lớp ---'
$h = Call GET "/members/$($A.id)/bookings" $null $A.token
Check 'A xem lịch sử' $h.status 200
Check 'tổng 3 lượt (c1 hủy, c2 hủy, c2 xác nhận)' $h.body.total 3
$up = Call GET "/members/$($A.id)/bookings?upcoming=true" $null $A.token
Check 'upcoming: chỉ 1 lượt đang xác nhận' @($up.body.items).Count 1
Check 'upcoming có cancellableUntil' ($null -ne @($up.body.items)[0].cancellableUntil) $true
Check 'lọc status=cancelled -> 2' (Call GET "/members/$($A.id)/bookings?status=cancelled" $null $A.token).body.total 2
Check 'member xem lịch sử người khác -> 403' (Call GET "/members/$($A.id)/bookings" $null $B.token).status 403
Check 'manager xem lịch sử hội viên' (Call GET "/members/$($A.id)/bookings" $null $mt).status 200
Check 'status sai -> 400' (Call GET "/members/$($A.id)/bookings?status=xyz" $null $A.token).status 400
Check 'limit=1000 -> 400' (Call GET "/members/$($A.id)/bookings?limit=1000" $null $A.token).status 400
Check 'hội viên không tồn tại -> 404' (Call GET "/members/$none/bookings" $null $mt).status 404

Write-Host '--- S1: 8 hội viên cùng đặt lớp sức chứa 3 ---'
$mem = 1..8 | ForEach-Object { NewMember $monthly.id }
$cS1 = NewClass 'QA S1' (VNIso $d 13) (VNIso $d 14) 3
$codes = ParallelBook ($mem | ForEach-Object { @{ classId = $cS1.body.id; token = $_.token } })
Check 'S1: đúng 3 lượt thành công (201)' (CountCode $codes '201') 3
Check 'S1: 5 lượt bị từ chối (409)' (CountCode $codes '409') 5
Check 'S1: không có lỗi 5xx' @($codes | Where-Object { $_ -like '5*' }).Count 0
Check 'S1 (I1): confirmedCount = 3' (Call GET "/classes/$($cS1.body.id)" $null $mt).body.confirmedCount 3
Check 'S1 (I1): số lượt đặt thực tế = 3' @((Call GET "/classes/$($cS1.body.id)/roster" $null $mt).body.roster).Count 3

Write-Host '--- S3: 1 hội viên (gói 2 buổi) đặt đồng thời 5 lớp khác nhau ---'
$M3 = NewMember $sess2.body.id
$cls = 1..5 | ForEach-Object { NewClass "QA S3-$_" (VNIso $d (13 + $_)) (VNIso $d (14 + $_)) 5 }
$codes = ParallelBook ($cls | ForEach-Object { @{ classId = $_.body.id; token = $M3.token } })
Check 'S3: đúng 2 lượt thành công (201)' (CountCode $codes '201') 2
Check 'S3: 3 lượt bị từ chối (409)' (CountCode $codes '409') 3
Check 'S3: không có lỗi 5xx' @($codes | Where-Object { $_ -like '5*' }).Count 0
Check 'S3 (I2): pendingCount = 2' (ActivePkg $M3.id).pendingCount 2
$total = 0; foreach ($c in $cls) { $total += (Call GET "/classes/$($c.body.id)" $null $mt).body.confirmedCount }
Check 'S3: tổng bộ đếm các lớp = 2 (không lớp nào bị tăng oan)' $total 2

Write-Host '--- S4: 1 hội viên gửi trùng 6 yêu cầu cùng một lớp ---'
$M4 = NewMember $monthly.id
$c4 = NewClass 'QA S4' (VNIso $d 19) (VNIso $d 20) 10
$codes = ParallelBook (1..6 | ForEach-Object { @{ classId = $c4.body.id; token = $M4.token } })
Check 'S4: đúng 1 lượt thành công (201)' (CountCode $codes '201') 1
Check 'S4: 5 lượt bị chặn (409)' (CountCode $codes '409') 5
Check 'S4: không có lỗi 5xx' @($codes | Where-Object { $_ -like '5*' }).Count 0
Check 'S4: confirmedCount = 1' (Call GET "/classes/$($c4.body.id)" $null $mt).body.confirmedCount 1
Check 'S4: pendingCount = 1 (các lần thất bại đã rollback)' (ActivePkg $M4.id).pendingCount 1

Write-Host ''
if ($script:fail -eq 0) { Write-Host 'TẤT CẢ ĐẠT' -ForegroundColor Green } else { Write-Host "$script:fail test FAIL" -ForegroundColor Red }