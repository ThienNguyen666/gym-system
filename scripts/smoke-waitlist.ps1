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
function Cnt($x) { @($x | Where-Object { $null -ne $_ }).Count }
function Login($email, $pw = $pass) { Call POST '/auth/login' @{ email = $email; password = $pw } }
function VNIso($date, $h, $m = 0) {
  $date.AddHours($h - 7).AddMinutes($m).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [Globalization.CultureInfo]::InvariantCulture)
}
function NewClass($title, $start, $end, $cap) {
  Call POST '/classes' @{ title = $title; startTime = $start; endTime = $end; capacity = $cap } $script:mt
}
function Book($classId, $token)   { Call POST "/classes/$classId/bookings" $null $token }
function JoinWL($classId, $token) { Call POST "/classes/$classId/waitlist" $null $token }
function CancelBk($id, $token)    { Call DELETE "/bookings/$id" $null $token }
function GivePackage($memberId, $pkgId) {
  $r = Call POST "/members/$memberId/packages" @{ packageId = $pkgId } $script:mt
  $p = Call POST '/payments' @{ memberPackageId = $r.body.memberPackage.id; amount = 1000; method = 'cash' } $script:mt
  return $p.body.payment.id
}
function NewMember($pkgId) {
  $email = "qw$(Get-Random)@gym.local"
  $m = Call POST '/members' @{ email = $email; fullName = 'QA Waiter'; password = $pass } $script:mt
  $res = @{ id = $m.body.id; payId = $null }
  if ($pkgId) { $res.payId = GivePackage $m.body.id $pkgId }
  $res.token = (Login $email).body.accessToken
  return $res
}
function ActivePkg($memberId) {
  (@((Call GET "/members/$memberId/packages" $null $script:mt).body) | Where-Object { $_.status -eq 'active' })[0]
}
function WaitingOf($m) { (Call GET "/members/$($m.id)/waitlist" $null $m.token).body }
function UpcomingOf($m) { (Call GET "/members/$($m.id)/bookings?upcoming=true" $null $m.token).body.items }
# Bắn song song nhiều yêu cầu (method, path, token), cùng giờ xuất phát; trả về mảng mã HTTP
function ParallelCall($reqs) {
  $startAt = [DateTime]::UtcNow.AddSeconds(3 + 0.7 * @($reqs).Count).Ticks
  $jobs = foreach ($q in $reqs) {
    Start-Job -ArgumentList $q.method, $q.path, $q.token, $startAt -ScriptBlock {
      param($method, $path, $tok, $ticks)
      $go = New-Object DateTime ($ticks, [DateTimeKind]::Utc)
      while ([DateTime]::UtcNow -lt $go) { Start-Sleep -Milliseconds 2 }
      try {
        $r = Invoke-WebRequest -Method $method -Uri "http://localhost:3000/api$path" -Headers @{ Authorization = "Bearer $tok" } -ContentType 'application/json' -UseBasicParsing
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
$none = '00000000-0000-4000-8000-000000000000'
$d = (Get-Date).ToUniversalTime().AddHours(7).Date.AddDays(7)

$pk = Call GET '/packages' $null $mt
$monthly = @($pk.body) | Where-Object { $_.type -eq 'duration' -and $_.durationDays -eq 30 } | Select-Object -First 1
$sess2 = Call POST '/packages' @{ name = "QA 2 buoi $(Get-Random)"; type = 'sessions'; price = 1000; totalSessions = 2 } $mt

Write-Host '--- Vào danh sách chờ ---'
$A = NewMember $monthly.id; $W1 = NewMember $monthly.id; $W2 = NewMember $monthly.id; $N = NewMember $null
$c1 = NewClass 'QA wl1' (VNIso $d 8) (VNIso $d 9) 1
$r = JoinWL $c1.body.id $W1.token
Check 'lớp còn chỗ -> 409' $r.status 409
Check 'type = class_has_spots' $r.body.type 'class_has_spots'
$bA = Book $c1.body.id $A.token
Check 'A đặt lớp (lớp đầy)' $bA.status 201
$r = JoinWL $c1.body.id $A.token
Check 'A (đã đặt) vào chờ -> 409' $r.status 409
Check 'type = already_booked' $r.body.type 'already_booked'
$r = JoinWL $c1.body.id $N.token
Check 'chưa có gói -> 409' $r.status 409
Check 'type = no_active_package' $r.body.type 'no_active_package'
Check 'manager vào chờ -> 403' (JoinWL $c1.body.id $mt).status 403
Check 'trainer vào chờ -> 403' (JoinWL $c1.body.id $trn.body.accessToken).status 403
Check 'lớp không tồn tại -> 404' (JoinWL $none $W1.token).status 404
Check 'id sai định dạng -> 400' (JoinWL 'abc' $W1.token).status 400
$j1 = JoinWL $c1.body.id $W1.token
Check 'W1 vào chờ' $j1.status 201
Check 'trạng thái waiting' $j1.body.status 'waiting'
Check 'W1 đứng vị trí 1' $j1.body.position 1
$j2 = JoinWL $c1.body.id $W2.token
Check 'W2 đứng vị trí 2' $j2.body.position 2
$dup = JoinWL $c1.body.id $W1.token
Check 'vào chờ trùng -> 409' $dup.status 409
Check 'type = already_waiting' $dup.body.type 'already_waiting'

Write-Host '--- Xem hàng chờ ---'
$lw = Call GET "/members/$($W2.id)/waitlist" $null $W2.token
Check 'W2 xem mục chờ của mình' $lw.status 200
Check 'W2 có 1 mục chờ' (Cnt $lw.body) 1
Check 'vị trí của W2 = 2' @($lw.body)[0].position 2
Check 'W1 xem mục chờ của W2 -> 403' (Call GET "/members/$($W2.id)/waitlist" $null $W1.token).status 403
Check 'manager xem mục chờ của hội viên' (Call GET "/members/$($W2.id)/waitlist" $null $mt).status 200
$lc = Call GET "/classes/$($c1.body.id)/waitlist" $null $mt
Check 'manager xem hàng chờ của lớp' $lc.status 200
Check 'hàng chờ có 2 người' (Cnt $lc.body) 2
Check 'FIFO: người đầu là W1' @($lc.body)[0].memberId $W1.id
Check 'member xem hàng chờ của lớp -> 403' (Call GET "/classes/$($c1.body.id)/waitlist" $null $W1.token).status 403
Check 'HLV không phụ trách xem hàng chờ -> 403' (Call GET "/classes/$($c1.body.id)/waitlist" $null $trn.body.accessToken).status 403

Write-Host '--- Rời hàng chờ ---'
Check 'W2 rời mục của W1 -> 403' (Call DELETE "/waitlist/$($j1.body.id)" $null $W2.token).status 403
Check 'mục chờ không tồn tại -> 404' (Call DELETE "/waitlist/$none" $null $W1.token).status 404
$lv = Call DELETE "/waitlist/$($j1.body.id)" $null $W1.token
Check 'W1 rời hàng chờ' $lv.status 200
Check 'trạng thái cancelled' $lv.body.status 'cancelled'
$lv2 = Call DELETE "/waitlist/$($j1.body.id)" $null $W1.token
Check 'rời lần 2 -> 409' $lv2.status 409
Check 'type = not_waiting' $lv2.body.type 'not_waiting'
Check 'W2 lên vị trí 1' @(WaitingOf $W2)[0].position 1
$j1b = JoinWL $c1.body.id $W1.token
Check 'W1 vào lại, đứng sau W2 (vị trí 2)' $j1b.body.position 2

Write-Host '--- Hủy lượt đặt -> đôn người chờ (BR5) ---'
$cn = CancelBk $bA.body.id $A.token
Check 'A hủy lượt đặt' $cn.status 200
Check 'promoted = true' $cn.body.promoted $true
Check 'W2 (đứng đầu) được đôn thành lượt đặt' (Cnt (UpcomingOf $W2)) 1
Check 'W1 chưa được đôn' (Cnt (UpcomingOf $W1)) 0
Check 'lớp vẫn đầy (confirmedCount = 1)' (Call GET "/classes/$($c1.body.id)" $null $mt).body.confirmedCount 1
Check 'W2 giữ 1 chỗ trong gói (pendingCount = 1)' (ActivePkg $W2.id).pendingCount 1
Check 'A đã trả chỗ giữ (pendingCount = 0)' (ActivePkg $A.id).pendingCount 0
Check 'W2 không còn trong hàng chờ' (Cnt (WaitingOf $W2)) 0
Check 'W1 lên vị trí 1' @(WaitingOf $W1)[0].position 1
Check 'W2 rời mục đã đôn -> 409' (Call DELETE "/waitlist/$($j2.body.id)" $null $W2.token).status 409
$cn = CancelBk (@(UpcomingOf $W2)[0].id) $W2.token
Check 'W2 hủy lượt vừa được đôn' $cn.status 200
Check 'W1 được đôn tiếp' (Cnt (UpcomingOf $W1)) 1
Check 'hàng chờ của lớp rỗng' (Cnt (Call GET "/classes/$($c1.body.id)/waitlist" $null $mt).body) 0
$cn = CancelBk (@(UpcomingOf $W1)[0].id) $W1.token
Check 'hủy khi hàng chờ rỗng -> promoted = false' $cn.body.promoted $false

Write-Host '--- Bỏ qua người không đủ điều kiện ---'
$A2 = NewMember $monthly.id; $W0 = NewMember $monthly.id; $W1b = NewMember $monthly.id
$c2 = NewClass 'QA wl2' (VNIso $d 9) (VNIso $d 10) 1
$bA2 = Book $c2.body.id $A2.token
Check 'A2 đặt lớp' $bA2.status 201
Check 'W0 vào chờ' (JoinWL $c2.body.id $W0.token).status 201
Check 'W1b vào chờ' (JoinWL $c2.body.id $W1b.token).status 201
Check 'hoàn tiền gói của W0 (W0 hết đủ điều kiện)' (Call POST "/payments/$($W0.payId)/refund" $null $mt).status 200
$cn = CancelBk $bA2.body.id $A2.token
Check 'A2 hủy: promoted = true' $cn.body.promoted $true
Check 'W1b (người kế tiếp) được đôn' (Cnt (UpcomingOf $W1b)) 1
Check 'W0 bị bỏ qua: không có lượt đặt' (Cnt (UpcomingOf $W0)) 0
Check 'W0 vẫn giữ chỗ trong hàng chờ' (Cnt (WaitingOf $W0)) 1

Write-Host '--- Không ai đủ điều kiện: chỗ trống giữ lại, đặt trực tiếp dọn mục chờ ---'
$A3 = NewMember $monthly.id; $X = NewMember $monthly.id
$c3 = NewClass 'QA wl3' (VNIso $d 10) (VNIso $d 11) 1
$bA3 = Book $c3.body.id $A3.token
Check 'X vào chờ' (JoinWL $c3.body.id $X.token).status 201
Check 'hoàn tiền gói của X' (Call POST "/payments/$($X.payId)/refund" $null $mt).status 200
$cn = CancelBk $bA3.body.id $A3.token
Check 'không ai đủ điều kiện -> promoted = false' $cn.body.promoted $false
Check 'lớp còn trống chỗ (confirmedCount = 0)' (Call GET "/classes/$($c3.body.id)" $null $mt).body.confirmedCount 0
Check 'X vẫn nằm trong hàng chờ' (Cnt (WaitingOf $X)) 1
GivePackage $X.id $monthly.id | Out-Null
Check 'X (đã gia hạn gói) đặt trực tiếp được' (Book $c3.body.id $X.token).status 201
Check 'mục chờ của X được dọn' (Cnt (WaitingOf $X)) 0

Write-Host '--- Điều kiện vào chờ khác ---'
$S = NewMember $sess2.body.id; $Y = NewMember $monthly.id
$k1 = NewClass 'QA k1' (VNIso $d 11) (VNIso $d 12) 5
$k2 = NewClass 'QA k2' (VNIso $d 12) (VNIso $d 13) 5
Check 'S đặt k1' (Book $k1.body.id $S.token).status 201
Check 'S đặt k2' (Book $k2.body.id $S.token).status 201
$cF = NewClass 'QA full' (VNIso $d 13) (VNIso $d 14) 1
Check 'Y đặt lớp full' (Book $cF.body.id $Y.token).status 201
$r = JoinWL $cF.body.id $S.token
Check 'hết buổi (gói 2 buổi đã giữ đủ) -> 409' $r.status 409
Check 'type = sessions_exhausted' $r.body.type 'sessions_exhausted'
$Z = NewMember $sess2.body.id; $B = NewMember $monthly.id
$cFar = NewClass 'QA far' (VNIso $d.AddDays(40) 8) (VNIso $d.AddDays(40) 9) 1
Check 'Z (gói số buổi, không hết hạn) đặt lớp xa' (Book $cFar.body.id $Z.token).status 201
$r = JoinWL $cFar.body.id $B.token
Check 'gói tháng không còn hiệu lực vào ngày học -> 409' $r.status 409
Check 'type = package_not_valid_on_class_date' $r.body.type 'package_not_valid_on_class_date'

Write-Host '--- S2b: 6 hội viên cùng vào hàng chờ ---'
$F = NewMember $monthly.id
$cJ = NewClass 'QA S2b' (VNIso $d 18) (VNIso $d 19) 1
Check 'F đặt lớp (lớp đầy)' (Book $cJ.body.id $F.token).status 201
$J = 1..6 | ForEach-Object { NewMember $monthly.id }
$codes = ParallelCall ($J | ForEach-Object { @{ method = 'POST'; path = "/classes/$($cJ.body.id)/waitlist"; token = $_.token } })
Check 'S2b: cả 6 yêu cầu đều 201' (CountCode $codes '201') 6
Check 'S2b: không có lỗi 5xx' @($codes | Where-Object { $_ -like '5*' }).Count 0
$lj = (Call GET "/classes/$($cJ.body.id)/waitlist" $null $mt).body
Check 'S2b: hàng chờ có đúng 6 người' (Cnt $lj) 6
Check 'S2b: vị trí là 1..6, không trùng' @($lj | ForEach-Object { $_.position } | Sort-Object -Unique).Count 6

Write-Host '--- S2: hủy + đôn người chờ ĐỒNG THỜI với đặt mới ---'
$M  = 1..3 | ForEach-Object { NewMember $monthly.id }   # 3 người giữ chỗ
$W  = 1..3 | ForEach-Object { NewMember $monthly.id }   # 3 người chờ
$Nw = 1..4 | ForEach-Object { NewMember $monthly.id }   # 4 người đặt mới
$cS2 = NewClass 'QA S2' (VNIso $d 17) (VNIso $d 18) 3
$mb = $M | ForEach-Object { Book $cS2.body.id $_.token }
Check 'S2: 3 người giữ chỗ lấp đầy lớp' (CountCode ($mb | ForEach-Object { [string]$_.status }) '201') 3
$wj = $W | ForEach-Object { JoinWL $cS2.body.id $_.token }
Check 'S2: 3 người vào hàng chờ' (CountCode ($wj | ForEach-Object { [string]$_.status }) '201') 3
$reqs = @()
for ($i = 0; $i -lt 3; $i++) { $reqs += @{ method = 'DELETE'; path = "/bookings/$($mb[$i].body.id)"; token = $M[$i].token } }
foreach ($n in $Nw) { $reqs += @{ method = 'POST'; path = "/classes/$($cS2.body.id)/bookings"; token = $n.token } }
$codes = ParallelCall $reqs
Check 'S2: 3 lần hủy đều thành công (200)' (CountCode $codes '200') 3
Check 'S2: 4 người đặt mới đều bị từ chối vì lớp đầy (409), không ai chen hàng' (CountCode $codes '409') 4
Check 'S2: không có lỗi 5xx' @($codes | Where-Object { $_ -like '5*' }).Count 0
Check 'S2 (I1): confirmedCount = 3' (Call GET "/classes/$($cS2.body.id)" $null $mt).body.confirmedCount 3
$ro = (Call GET "/classes/$($cS2.body.id)/roster" $null $mt).body.roster
$confirmed = @($ro | Where-Object { $_.status -eq 'confirmed' })
Check 'S2 (I1): số lượt confirmed thực tế = 3' $confirmed.Count 3
$wids = $W | ForEach-Object { $_.id }
Check 'S2: cả 3 người chờ đều được đôn' @($confirmed | Where-Object { $wids -contains $_.memberId }).Count 3
Check 'S2: hàng chờ đã rỗng' (Cnt (Call GET "/classes/$($cS2.body.id)/waitlist" $null $mt).body) 0
$pm = 0; foreach ($x in $M) { $pm += (ActivePkg $x.id).pendingCount }
$pw = 0; foreach ($x in $W) { $pw += (ActivePkg $x.id).pendingCount }
Check 'S2 (I2): 3 người giữ chỗ cũ đã trả hết chỗ (tổng pendingCount = 0)' $pm 0
Check 'S2 (I2): 3 người được đôn mỗi người giữ đúng 1 chỗ (tổng = 3)' $pw 3

Write-Host ''
if ($script:fail -eq 0) { Write-Host 'TẤT CẢ ĐẠT' -ForegroundColor Green } else { Write-Host "$script:fail test FAIL" -ForegroundColor Red }