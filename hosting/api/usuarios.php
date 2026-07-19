<?php
require_once __DIR__ . '/helpers.php';
cors_headers();
$user = auth_required();
$pdo  = get_pdo();

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id'])     ? (int)$_GET['id'] : null;
$action = $_GET['action']        ?? null;
$body   = in_array($method, ['POST','PUT','PATCH']) ? get_body() : [];

try {
    // ── Acción especial: actualizar último acceso ─────────────────────────────
    if ($method === 'PATCH' && $action === 'ultimo_acceso' && $id) {
        $pdo->prepare('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?')->execute([$id]);
        json_response(['ok' => true]);
    }

    // ── Acción especial: cambiar contraseña con verificación ─────────────────
    if ($method === 'POST' && $action === 'cambiar_password') {
        $idTarget   = isset($body['id'])         ? (int)$body['id']  : null;
        $passActual = $body['passActual']         ?? '';
        $passNueva  = $body['passNueva']          ?? '';
        if (!$idTarget || !$passActual || !$passNueva) json_error('Datos incompletos');
        // Solo el propio usuario puede cambiar su contraseña
        if ($idTarget !== (int)$user['id']) json_error('No autorizado', 403);
        if (strlen($passNueva) < 8) json_error('La nueva contraseña debe tener al menos 8 caracteres');

        $stmt = $pdo->prepare('SELECT password FROM usuarios WHERE id = ? AND activo = 1');
        $stmt->execute([$idTarget]);
        $row = $stmt->fetch();
        if (!$row) json_error('Usuario no encontrado', 404);
        if (!password_verify($passActual, $row['password'])) json_error('La contraseña actual es incorrecta', 403);

        $pdo->prepare('UPDATE usuarios SET password = ? WHERE id = ?')
            ->execute([password_hash($passNueva, PASSWORD_BCRYPT), $idTarget]);
        json_response(['ok' => true]);
    }

    switch ($method) {
        case 'GET':
            require_permission($pdo, $user, 'gestionarUsuarios');
            $stmt = $pdo->query('SELECT id,nombre,email,rol_id,empresa_id,empresa_nombre,activo,creado_en,ultimo_acceso FROM usuarios ORDER BY nombre');
            json_response(array_map('row_usuario', $stmt->fetchAll()));

        case 'POST':
            require_permission($pdo, $user, 'gestionarUsuarios');
            if (empty($body['nombre']) || empty($body['email'])) json_error('Nombre y email son requeridos');
            if (empty($body['password'])) json_error('La contraseña es requerida');

            $hash = password_hash($body['password'], PASSWORD_BCRYPT);
            $stmt = $pdo->prepare('INSERT INTO usuarios (nombre,email,password,rol_id,empresa_id,empresa_nombre,activo) VALUES (?,?,?,?,?,?,?)');
            $stmt->execute([
                $body['nombre'],
                strtolower(trim($body['email'])),
                $hash,
                $body['rolId']         ?? null,
                $body['empresaId']     ? (int)$body['empresaId'] : null,
                $body['empresaNombre'] ?? null,
                isset($body['activo']) ? (int)(bool)$body['activo'] : 1,
            ]);
            $newId = (int)$pdo->lastInsertId();
            $stmt2 = $pdo->prepare('SELECT * FROM usuarios WHERE id=?');
            $stmt2->execute([$newId]);
            $row = $stmt2->fetch();
            json_response(row_usuario($row), 201);

        case 'PUT':
            require_permission($pdo, $user, 'gestionarUsuarios');
            if (!$id) json_error('ID requerido');

            // Si viene password sin hash, hashearla
            $passwordSql = '';
            $params = [];

            if (!empty($body['password']) && !str_starts_with($body['password'], '$2')) {
                $passwordSql = ', password = ?';
                $params[]    = password_hash($body['password'], PASSWORD_BCRYPT);
            }

            $stmt = $pdo->prepare("UPDATE usuarios SET nombre=?,email=?,rol_id=?,empresa_id=?,empresa_nombre=?,activo=?$passwordSql WHERE id=?");
            $baseParams = [
                $body['nombre'],
                strtolower(trim($body['email'])),
                $body['rolId']         ?? null,
                $body['empresaId']     ? (int)$body['empresaId'] : null,
                $body['empresaNombre'] ?? null,
                isset($body['activo']) ? (int)(bool)$body['activo'] : 1,
            ];
            $stmt->execute(array_merge($baseParams, $params, [$id]));

            $stmt3 = $pdo->prepare('SELECT * FROM usuarios WHERE id=?');
            $stmt3->execute([$id]);
            $row = $stmt3->fetch();
            json_response(row_usuario($row));

        case 'DELETE':
            require_permission($pdo, $user, 'gestionarUsuarios');
            if (!$id) json_error('ID requerido');
            if ($id === (int)$user['id']) json_error('No puede eliminar su propia cuenta', 403);
            $pdo->prepare('DELETE FROM usuarios WHERE id=?')->execute([$id]);
            json_response(['ok' => true]);

        default:
            json_error('Método no permitido', 405);
    }
} catch (PDOException $e) {
    error_log('[otec-demo] DB error in ' . basename(__FILE__) . ': ' . $e->getMessage());
    json_error('Error al procesar la solicitud', 500);
}

function row_usuario(array $r): array {
    return [
        'id'            => (int)$r['id'],
        'nombre'        => $r['nombre'],
        'email'         => $r['email'],
        'rolId'         => $r['rol_id'],
        'empresaId'     => $r['empresa_id']     ? (int)$r['empresa_id'] : null,
        'empresaNombre' => $r['empresa_nombre'] ?? null,
        'activo'        => (bool)$r['activo'],
        'creadoEn'      => $r['creado_en'],
        'ultimoAcceso'  => $r['ultimo_acceso'],
    ];
}
