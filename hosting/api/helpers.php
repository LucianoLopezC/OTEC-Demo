<?php
// ════════════════════════════════════════════════════════════════════════════
// helpers.php — JWT, respuestas JSON, conexión PDO, middleware de auth
// ════════════════════════════════════════════════════════════════════════════

date_default_timezone_set('America/Santiago');

require_once __DIR__ . '/config.php';

// ─── Conexión PDO ─────────────────────────────────────────────────────────────
function get_pdo(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    } catch (PDOException $e) {
        json_error('Error de conexión a la base de datos', 500);
    }
    return $pdo;
}

// ─── Respuestas JSON ──────────────────────────────────────────────────────────
function json_response(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status = 400): never {
    json_response(['error' => true, 'message' => $message], $status);
}

// ─── Leer body JSON del request ───────────────────────────────────────────────
function get_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// ─── JWT ──────────────────────────────────────────────────────────────────────
function b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
}

function jwt_create(array $payload): string {
    $header  = b64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload = b64url_encode(json_encode($payload));
    $sig     = b64url_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function jwt_verify(string $token): array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) json_error('Token inválido', 401);

    [$header, $payload, $sig] = $parts;
    $expected = b64url_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) json_error('Token inválido', 401);

    $data = json_decode(b64url_decode($payload), true);
    if (!$data) json_error('Token malformado', 401);
    if (($data['exp'] ?? 0) < time()) json_error('Sesión expirada. Vuelva a iniciar sesión.', 401);

    return $data;
}

// ─── Autorización por permiso ─────────────────────────────────────────────────
// Replica de ROLES_SISTEMA en AppContext.jsx — mantener sincronizado
function system_role_permisos(string $rolId): ?array {
    $roles = [
        'superadmin' => [
            'verDashboard' => true, 'verEmpresas' => true, 'verPersonas' => true,
            'verUsuarios' => true, 'verEmision' => true, 'verVerificar' => true,
            'verReportes' => true, 'verCursos' => true, 'verPlantillas' => true,
            'crearEmpresa' => true, 'editarEmpresa' => true, 'eliminarEmpresa' => true,
            'crearPersona' => true, 'crearCurso' => true, 'emitirCertificados' => true,
            'gestionarUsuarios' => true, 'gestionarRoles' => true, 'exportarDatos' => true,
            'verCotizador' => true, 'verDatosEmpresaPropia' => false,
        ],
        'operador' => [
            'verDashboard' => true, 'verEmpresas' => false, 'verPersonas' => false,
            'verUsuarios' => false, 'verEmision' => true, 'verVerificar' => true,
            'verReportes' => true, 'verCursos' => true, 'verPlantillas' => false,
            'crearEmpresa' => false, 'editarEmpresa' => false, 'eliminarEmpresa' => false,
            'crearPersona' => false, 'crearCurso' => false, 'emitirCertificados' => true,
            'gestionarUsuarios' => false, 'gestionarRoles' => false, 'exportarDatos' => true,
            'verCotizador' => false, 'verDatosEmpresaPropia' => false,
        ],
        'empresa' => [
            'verDashboard' => true, 'verEmpresas' => false, 'verPersonas' => true,
            'verUsuarios' => false, 'verEmision' => true, 'verVerificar' => true,
            'verReportes' => true, 'verCursos' => false, 'verPlantillas' => false,
            'crearEmpresa' => false, 'editarEmpresa' => false, 'eliminarEmpresa' => false,
            'crearPersona' => true, 'crearCurso' => false, 'emitirCertificados' => false,
            'gestionarUsuarios' => false, 'gestionarRoles' => false, 'exportarDatos' => false,
            'verCotizador' => false, 'verDatosEmpresaPropia' => true,
        ],
    ];
    return $roles[$rolId] ?? null;
}

function get_user_permissions(PDO $pdo, array $claims): array {
    $rolId  = $claims['rolId'] ?? '';
    $system = system_role_permisos($rolId);
    if ($system !== null) return $system;
    try {
        $stmt = $pdo->prepare('SELECT permisos FROM roles WHERE id = ?');
        $stmt->execute([$rolId]);
        $row = $stmt->fetch();
        return $row ? (json_decode($row['permisos'] ?? '{}', true) ?? []) : [];
    } catch (PDOException $e) {
        error_log('[otec-demo] get_user_permissions error: ' . $e->getMessage());
        return [];
    }
}

function require_permission(PDO $pdo, array $claims, string $permiso): void {
    $permisos = get_user_permissions($pdo, $claims);
    if (($permisos[$permiso] ?? false) !== true) {
        json_error('No tiene permisos para realizar esta acción', 403);
    }
}

// ─── Middleware: verificar token ──────────────────────────────────────────────
function auth_required(): array {
    // Apache a veces mueve el header a REDIRECT_HTTP_AUTHORIZATION
    $header = $_SERVER['HTTP_AUTHORIZATION']
           ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
           ?? getallheaders()['Authorization']
           ?? '';
    if (!str_starts_with($header, 'Bearer ')) {
        json_error('No autenticado', 401);
    }
    $token = substr($header, 7);
    return jwt_verify($token);
}

// ─── Headers CORS ─────────────────────────────────────────────────────────────
// Solo acepta el origen definido en APP_URL (configurado en config.php)
function cors_headers(bool $public = false): void {
    $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = [APP_URL];

    if ($public) {
        header('Access-Control-Allow-Origin: *');
    } elseif (in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    } else {
        header('Access-Control-Allow-Origin: ' . APP_URL);
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 86400');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
