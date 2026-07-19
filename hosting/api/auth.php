<?php
// ════════════════════════════════════════════════════════════════════════════
// auth.php — Login y verificación de token
// POST /api/auth.php          → login con email+password → devuelve JWT
// GET  /api/auth.php          → verificar token → devuelve datos del usuario
// ════════════════════════════════════════════════════════════════════════════

require_once __DIR__ . '/helpers.php';
cors_headers();

$pdo    = get_pdo();
$method = $_SERVER['REQUEST_METHOD'];

// ─── GET: verificar token activo ──────────────────────────────────────────────
if ($method === 'GET') {
    $claims = auth_required();
    // Recargar datos frescos del usuario desde la BD
    $stmt = $pdo->prepare('SELECT id, nombre, email, rol_id, empresa_id, empresa_nombre, activo FROM usuarios WHERE id = ? AND activo = 1');
    $stmt->execute([$claims['id']]);
    $u = $stmt->fetch();
    if (!$u) json_error('Usuario no encontrado o inactivo', 401);
    json_response(['usuario' => row_to_usuario_public($u)]);
}

// ─── POST: login ──────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $body     = get_body();
    $email    = trim(strtolower($body['email'] ?? ''));
    $password = $body['password'] ?? '';

    if (!$email || !$password) json_error('Correo y contraseña son requeridos');

    // ── Rate limiting: máx 10 intentos fallidos por IP en 15 minutos ─────────
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ip = trim(explode(',', $ip)[0]); // Tomar solo la primera IP si hay proxy
    rate_limit_check($pdo, $ip);

    $stmt = $pdo->prepare('SELECT * FROM usuarios WHERE LOWER(email) = ? LIMIT 1');
    $stmt->execute([$email]);
    $u = $stmt->fetch();

    if (!$u || !$u['activo']) {
        rate_limit_add_fail($pdo, $ip);
        json_error('Credenciales incorrectas o cuenta inactiva', 401);
    }

    if (!password_verify($password, $u['password'])) {
        rate_limit_add_fail($pdo, $ip);
        json_error('Credenciales incorrectas o cuenta inactiva', 401);
    }

    // Login exitoso — resetear contador de fallos
    rate_limit_reset($pdo, $ip);

    // Actualizar último acceso
    $pdo->prepare('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?')->execute([$u['id']]);

    $payload = [
        'id'            => (int)$u['id'],
        'email'         => $u['email'],
        'rolId'         => $u['rol_id'],
        'empresaId'     => $u['empresa_id'] ? (int)$u['empresa_id'] : null,
        'empresaNombre' => $u['empresa_nombre'],
        'iat'           => time(),
        'exp'           => time() + JWT_EXPIRE_SECONDS,
    ];

    json_response([
        'token'   => jwt_create($payload),
        'usuario' => row_to_usuario_public($u),
    ]);
}

json_error('Método no permitido', 405);

// ─── Rate Limiting (MySQL-based, funciona en hosting compartido) ─────────────
// Requiere tabla: CREATE TABLE IF NOT EXISTS auth_rate_limit (
//   ip VARCHAR(45) NOT NULL,
//   intentos INT NOT NULL DEFAULT 0,
//   ultimo_intento DATETIME NOT NULL,
//   PRIMARY KEY (ip)
// ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

function rate_limit_check(PDO $pdo, string $ip): void {
    $ventana  = 15 * 60;   // 15 minutos en segundos
    $maxFallos = 10;        // máximo de intentos fallidos

    try {
        $stmt = $pdo->prepare(
            'SELECT intentos, UNIX_TIMESTAMP(ultimo_intento) AS ts
             FROM auth_rate_limit WHERE ip = ?'
        );
        $stmt->execute([$ip]);
        $row = $stmt->fetch();

        if ($row) {
            $tiempoTranscurrido = time() - (int)$row['ts'];
            if ($tiempoTranscurrido > $ventana) {
                // Ventana expirada — limpiar
                $pdo->prepare('DELETE FROM auth_rate_limit WHERE ip = ?')->execute([$ip]);
                return;
            }
            if ((int)$row['intentos'] >= $maxFallos) {
                $esperarSeg = $ventana - $tiempoTranscurrido;
                json_error('Demasiados intentos fallidos. Intente de nuevo en ' . ceil($esperarSeg / 60) . ' minuto(s).', 429);
            }
        }
    } catch (PDOException $e) {
        // Si la tabla no existe, no bloquear login (degradación elegante)
        error_log('[otec-demo] rate_limit error: ' . $e->getMessage());
    }
}

function rate_limit_add_fail(PDO $pdo, string $ip): void {
    try {
        $pdo->prepare(
            'INSERT INTO auth_rate_limit (ip, intentos, ultimo_intento)
             VALUES (?, 1, NOW())
             ON DUPLICATE KEY UPDATE intentos = intentos + 1, ultimo_intento = NOW()'
        )->execute([$ip]);
    } catch (PDOException $e) {
        error_log('[otec-demo] rate_limit_fail error: ' . $e->getMessage());
    }
}

function rate_limit_reset(PDO $pdo, string $ip): void {
    try {
        $pdo->prepare('DELETE FROM auth_rate_limit WHERE ip = ?')->execute([$ip]);
    } catch (PDOException $e) {
        error_log('[otec-demo] rate_limit_reset error: ' . $e->getMessage());
    }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function row_to_usuario_public(array $u): array {
    return [
        'id'            => (int)$u['id'],
        'nombre'        => $u['nombre'],
        'email'         => $u['email'],
        'rolId'         => $u['rol_id'],
        'empresaId'     => $u['empresa_id'] ? (int)$u['empresa_id'] : null,
        'empresaNombre' => $u['empresa_nombre'],
        'activo'        => (bool)$u['activo'],
    ];
}
