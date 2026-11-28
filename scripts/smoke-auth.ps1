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

# --- Đăng nhập ---
$admin = Login 'admin@gym.local'
Check 'admin login' $admin.status 200
Check 'login sai mật khẩu' (Login 'admin@gym.local' 'sai-roi').status 401
Check 'login email sai định dạng' (Call POST '/auth/login' @{ email = 'abc'; password = 'x' }).status 400
Check 'không token -> /auth/me' (Call GET '/auth/me').status 401
$me = Call GET '/auth/me' $null $admin.body.accessToken
Check '/auth/me trả đúng role' $me.body.role 'admin'

# --- RBAC ---
$mem = Login 'member1@gym.local'
Check 'member gọi API admin -> 403' (Call GET '/users' $null $mem.body.accessToken).status 403
$trn = Login 'trainer1@gym.local'
Check 'trainer gọi API admin -> 403' (Call GET '/users' $null $trn.body.accessToken).status 403
$list = Call GET '/users' $null $admin.body.accessToken
Check 'admin list users' $list.status 200
Check 'seed có 13 user' @($list.body).Count 13
Check 'danh sách không lộ passwordHash' ($null -eq @($list.body)[0].passwordHash) $true
Check 'lọc ?role=member -> 8' @((Call GET '/users?role=member' $null $admin.body.accessToken).body).Count 8
Check 'lọc ?role=trainer -> 3' @((Call GET '/users?role=trainer' $null $admin.body.accessToken).body).Count 3
Check 'lọc ?role=xyz -> 400' (Call GET '/users?role=xyz' $null $admin.body.accessToken).status 400

# --- Tạo Manager, trùng email ---
$email = "qa$(Get-Random)@gym.local"
$new = Call POST '/users/managers' @{ email = $email; fullName = 'QA Manager'; password = 'Passw0rd!' } $admin.body.accessToken
Check 'admin tạo manager' $new.status 201
Check 'tạo trùng email -> 409' (Call POST '/users/managers' @{ email = $email; fullName = 'x'; password = 'Passw0rd!' } $admin.body.accessToken).status 409
Check 'mật khẩu ngắn -> 400' (Call POST '/users/managers' @{ email = "b$email"; fullName = 'x'; password = '123' } $admin.body.accessToken).status 400
$mid = $new.body.id

# --- Khóa tài khoản có hiệu lực NGAY ---
$m1 = Login $email
Check 'manager mới login' $m1.status 200
Check 'admin không tự khóa mình -> 400' (Call PATCH "/users/$($admin.body.user.id)/status" @{ status = 'disabled' } $admin.body.accessToken).status 400
Check 'admin khóa manager' (Call PATCH "/users/$mid/status" @{ status = 'disabled' } $admin.body.accessToken).status 200
Check 'access token cũ bị chặn ngay' (Call GET '/auth/me' $null $m1.body.accessToken).status 401
Check 'login tài khoản bị khóa -> 403' (Login $email).status 403
Check 'refresh tài khoản bị khóa -> 401' (Call POST '/auth/refresh' @{ refreshToken = $m1.body.refreshToken }).status 401
Call PATCH "/users/$mid/status" @{ status = 'active' } $admin.body.accessToken | Out-Null
Check 'mở khóa rồi login lại' (Login $email).status 200

# --- Xoay vòng refresh token + phát hiện dùng lại ---
$a = Login 'member2@gym.local'
$r1 = Call POST '/auth/refresh' @{ refreshToken = $a.body.refreshToken }
Check 'refresh lần 1' $r1.status 200
Check 'dùng lại refresh token cũ -> 401' (Call POST '/auth/refresh' @{ refreshToken = $a.body.refreshToken }).status 401
Check 'token mới cũng bị thu hồi (nghi bị lộ)' (Call POST '/auth/refresh' @{ refreshToken = $r1.body.refreshToken }).status 401

# --- Logout ---
$b = Login 'member3@gym.local'
Check 'logout' (Call POST '/auth/logout' @{ refreshToken = $b.body.refreshToken }).status 204
Check 'refresh sau logout -> 401' (Call POST '/auth/refresh' @{ refreshToken = $b.body.refreshToken }).status 401

# --- Đổi mật khẩu (dùng tài khoản QA, không đụng seed) ---
$q = Login $email
Check 'đổi mk: sai mật khẩu hiện tại -> 400' (Call POST '/auth/change-password' @{ currentPassword = 'sai'; newPassword = 'NewPassw0rd!' } $q.body.accessToken).status 400
Check 'đổi mk: mật khẩu mới ngắn -> 400' (Call POST '/auth/change-password' @{ currentPassword = $pass; newPassword = '123' } $q.body.accessToken).status 400
Check 'đổi mật khẩu' (Call POST '/auth/change-password' @{ currentPassword = $pass; newPassword = 'NewPassw0rd!' } $q.body.accessToken).status 204
Check 'refresh token cũ bị thu hồi sau đổi mk' (Call POST '/auth/refresh' @{ refreshToken = $q.body.refreshToken }).status 401
Check 'mật khẩu cũ không login được' (Login $email).status 401
Check 'mật khẩu mới login được' (Login $email 'NewPassw0rd!').status 200

Write-Host ''
if ($script:fail -eq 0) { Write-Host 'TẤT CẢ ĐẠT' -ForegroundColor Green } else { Write-Host "$script:fail test FAIL" -ForegroundColor Red }