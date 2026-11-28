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
    return @{ status = [int]$_.Exception.Response.StatusCode; body = $null }
  }
}
function Check($name, $actual, $expected) {
  if ($actual -eq $expected) { Write-Host "PASS  $name" -ForegroundColor Green }
  else { Write-Host "FAIL  $name (got $actual, expected $expected)" -ForegroundColor Red; $script:fail++ }
}
function Login($email, $pw = $pass) { Call POST '/auth/login' @{ email = $email; password = $pw } }

$mgr = Login 'manager@gym.local'; $mt = $mgr.body.accessToken
$adm = Login 'admin@gym.local';   $at = $adm.body.accessToken
$m1  = Login 'member1@gym.local'; $t1 = $m1.body.accessToken
$m2  = Login 'member2@gym.local'
$trn = Login 'trainer1@gym.local'
$none = '00000000-0000-4000-8000-000000000000'

Write-Host '--- Packages ---'
$pk = Call GET '/packages' $null $mt
Check 'manager xem gói' $pk.status 200
Check 'có >= 2 gói' (@($pk.body).Count -ge 2) $true
Check 'member xem gói' (Call GET '/packages' $null $t1).status 200
Check 'trainer xem gói -> 403' (Call GET '/packages' $null $trn.body.accessToken).status 403
Check 'member tạo gói -> 403' (Call POST '/packages' @{ name = 'x'; type = 'duration'; price = 1; durationDays = 30 } $t1).status 403
Check 'gói thời hạn thiếu durationDays -> 400' (Call POST '/packages' @{ name = 'x'; type = 'duration'; price = 1000 } $mt).status 400
Check 'gói số buổi thiếu totalSessions -> 400' (Call POST '/packages' @{ name = 'x'; type = 'sessions'; price = 1000 } $mt).status 400
Check 'giá âm -> 400' (Call POST '/packages' @{ name = 'x'; type = 'duration'; price = -5; durationDays = 30 } $mt).status 400
$np = Call POST '/packages' @{ name = "QA $(Get-Random)"; type = 'sessions'; price = 100000; totalSessions = 5 } $mt
Check 'tạo gói' $np.status 201
Check 'ngừng bán gói' (Call PATCH "/packages/$($np.body.id)" @{ isActive = $false } $mt).status 200
$ml = Call GET '/packages' $null $t1
Check 'member không thấy gói ngừng bán' @(@($ml.body) | Where-Object { $_.id -eq $np.body.id }).Count 0
$ll = Call GET '/packages' $null $mt
Check 'manager vẫn thấy gói ngừng bán' @(@($ll.body) | Where-Object { $_.id -eq $np.body.id }).Count 1
$monthly = @($pk.body) | Where-Object { $_.type -eq 'duration' -and $_.durationDays -eq 30 } | Select-Object -First 1
$ten     = @($pk.body) | Where-Object { $_.type -eq 'sessions' -and $_.totalSessions -eq 10 } | Select-Object -First 1

Write-Host '--- Members ---'
$email = "qa$(Get-Random)@gym.local"
$nm = Call POST '/members' @{ email = $email; fullName = 'QA Member'; password = $pass } $mt
Check 'manager tạo hội viên' $nm.status 201
$mid = $nm.body.id
Check 'tạo trùng email -> 409' (Call POST '/members' @{ email = $email; fullName = 'x'; password = $pass } $mt).status 409
Check 'mật khẩu ngắn -> 400' (Call POST '/members' @{ email = "b$email"; fullName = 'x'; password = '123' } $mt).status 400
Check 'admin tạo hội viên -> 403' (Call POST '/members' @{ email = "c$email"; fullName = 'x'; password = $pass } $at).status 403
Check 'member tạo hội viên -> 403' (Call POST '/members' @{ email = "d$email"; fullName = 'x'; password = $pass } $t1).status 403
$q = Login $email
Check 'hội viên mới đăng nhập được' $q.status 200
Check 'tìm theo email' (Call GET "/members?search=$email" $null $mt).body.total 1
Check 'phân trang limit=5' (@((Call GET '/members?page=1&limit=5' $null $mt).body.items).Count -le 5) $true
Check 'limit=1000 -> 400' (Call GET '/members?limit=1000' $null $mt).status 400
Check 'member gọi list -> 403' (Call GET '/members' $null $t1).status 403
$id1 = $m1.body.user.id; $id2 = $m2.body.user.id
Check 'member xem hồ sơ mình' (Call GET "/members/$id1" $null $t1).status 200
Check 'member xem hồ sơ người khác -> 403' (Call GET "/members/$id2" $null $t1).status 403
Check 'manager xem hồ sơ bất kỳ' (Call GET "/members/$id2" $null $mt).status 200
Check 'id không phải uuid -> 400' (Call GET '/members/abc' $null $mt).status 400
Check 'id không tồn tại -> 404' (Call GET "/members/$none" $null $mt).status 404
Check 'member sửa tên mình' (Call PATCH "/members/$id1" @{ fullName = 'Hoi vien 1' } $t1).status 200
Check 'member sửa hồ sơ người khác -> 403' (Call PATCH "/members/$id2" @{ fullName = 'hack' } $t1).status 403
Check 'member tự đổi status -> 403' (Call PATCH "/members/$id1/status" @{ status = 'disabled' } $t1).status 403
Check 'manager khóa hội viên' (Call PATCH "/members/$mid/status" @{ status = 'disabled' } $mt).status 200
Check 'hội viên bị khóa login -> 403' (Login $email).status 403
Check 'đăng ký gói cho hội viên bị khóa -> 400' (Call POST "/members/$mid/packages" @{ packageId = $monthly.id } $mt).status 400
Check 'manager mở khóa' (Call PATCH "/members/$mid/status" @{ status = 'active' } $mt).status 200
Check 'đổi status của trainer -> 404' (Call PATCH "/members/$($trn.body.user.id)/status" @{ status = 'disabled' } $mt).status 404

Write-Host '--- Đăng ký gói + thanh toán ---'
$r1 = Call POST "/members/$mid/packages" @{ packageId = $monthly.id } $mt
Check 'đăng ký gói' $r1.status 201
Check 'gói mới ở trạng thái pending' $r1.body.memberPackage.status 'pending'
Check 'amountDue đúng giá niêm yết' ([decimal]$r1.body.amountDue) ([decimal]$monthly.price)
Check 'đăng ký gói ngừng bán -> 400' (Call POST "/members/$mid/packages" @{ packageId = $np.body.id } $mt).status 400
Check 'đăng ký gói id lạ -> 400' (Call POST "/members/$mid/packages" @{ packageId = $none } $mt).status 400
Check 'member tự đăng ký gói -> 403' (Call POST "/members/$mid/packages" @{ packageId = $monthly.id } $q.body.accessToken).status 403
$mp1 = $r1.body.memberPackage.id
Check 'số tiền 0 -> 400' (Call POST '/payments' @{ memberPackageId = $mp1; amount = 0; method = 'cash' } $mt).status 400
Check 'phương thức sai -> 400' (Call POST '/payments' @{ memberPackageId = $mp1; amount = 1000; method = 'bitcoin' } $mt).status 400
Check 'member ghi thanh toán -> 403' (Call POST '/payments' @{ memberPackageId = $mp1; amount = 1000; method = 'cash' } $q.body.accessToken).status 403
Check 'thanh toán gói không tồn tại -> 404' (Call POST '/payments' @{ memberPackageId = $none; amount = 1000; method = 'cash' } $mt).status 404
$p1 = Call POST '/payments' @{ memberPackageId = $mp1; amount = 500000; method = 'cash' } $mt
Check 'ghi thanh toán' $p1.status 201
Check 'gói được kích hoạt' $p1.body.memberPackage.status 'active'
Check 'activated = true' $p1.body.activated $true
Check 'thanh toán lại cùng gói -> 409' (Call POST '/payments' @{ memberPackageId = $mp1; amount = 500000; method = 'cash' } $mt).status 409

$r2 = Call POST "/members/$mid/packages" @{ packageId = $ten.id } $mt
$p2 = Call POST '/payments' @{ memberPackageId = $r2.body.memberPackage.id; amount = 800000; method = 'transfer' } $mt
Check 'gói thứ 2 đã trả nhưng xếp hàng (pending)' $p2.body.memberPackage.status 'pending'
Check 'activated = false' $p2.body.activated $false
$mpl = Call GET "/members/$mid/packages" $null $mt
Check 'chỉ đúng 1 gói active' @(@($mpl.body) | Where-Object { $_.status -eq 'active' }).Count 1
Check 'member xem gói của mình' (Call GET "/members/$mid/packages" $null $q.body.accessToken).status 200
Check 'member xem gói người khác -> 403' (Call GET "/members/$mid/packages" $null $t1).status 403
Check 'member xem 2 thanh toán của mình' @((Call GET "/members/$mid/payments" $null $q.body.accessToken).body).Count 2
Check 'member xem thanh toán người khác -> 403' (Call GET "/members/$mid/payments" $null $t1).status 403

Write-Host '--- Hoàn tiền ---'
Check 'member hoàn tiền -> 403' (Call POST "/payments/$($p1.body.payment.id)/refund" $null $q.body.accessToken).status 403
Check 'hoàn tiền' (Call POST "/payments/$($p1.body.payment.id)/refund" $null $mt).status 200
Check 'hoàn tiền lần 2 -> 409' (Call POST "/payments/$($p1.body.payment.id)/refund" $null $mt).status 409
$mpl2 = Call GET "/members/$mid/packages" $null $mt
Check 'gói đã hoàn tiền -> cancelled' (@($mpl2.body) | Where-Object { $_.id -eq $mp1 }).status 'cancelled'

Write-Host '--- Thanh toán đồng thời (khóa theo hội viên) ---'
$cm = Call POST '/members' @{ email = "qa$(Get-Random)@gym.local"; fullName = 'QA Concurrent'; password = $pass } $mt
$cid = $cm.body.id
$ca = Call POST "/members/$cid/packages" @{ packageId = $monthly.id } $mt
$cb = Call POST "/members/$cid/packages" @{ packageId = $ten.id } $mt
$jobs = foreach ($x in @($ca.body.memberPackage.id, $cb.body.memberPackage.id)) {
  Start-Job -ArgumentList $x, $mt -ScriptBlock {
    param($mpId, $tok)
    try {
      $r = Invoke-WebRequest -Method POST -Uri 'http://localhost:3000/api/payments' -Headers @{ Authorization = "Bearer $tok" } -ContentType 'application/json' -Body (@{ memberPackageId = $mpId; amount = 100000; method = 'cash' } | ConvertTo-Json) -UseBasicParsing
      [string][int]$r.StatusCode
    } catch { [string][int]$_.Exception.Response.StatusCode }
  }
}
$codes = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job
Check 'cả 2 thanh toán song song đều 201 (không 500)' @($codes | Where-Object { $_ -eq '201' }).Count 2
$cl = Call GET "/members/$cid/packages" $null $mt
Check 'vẫn chỉ đúng 1 gói active' @(@($cl.body) | Where-Object { $_.status -eq 'active' }).Count 1

Write-Host ''
if ($script:fail -eq 0) { Write-Host 'TẤT CẢ ĐẠT' -ForegroundColor Green } else { Write-Host "$script:fail test FAIL" -ForegroundColor Red }