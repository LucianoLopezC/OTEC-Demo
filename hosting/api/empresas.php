<?php
require_once __DIR__ . '/helpers.php';
cors_headers();
$user = auth_required();
$pdo  = get_pdo();

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$body   = ($method === 'POST' || $method === 'PUT') ? get_body() : [];

try {
    switch ($method) {
        // ── Listar ────────────────────────────────────────────────────────────
        case 'GET':
            $stmt = $pdo->query('SELECT * FROM empresas ORDER BY nombre');
            json_response(array_map('row_empresa', $stmt->fetchAll()));

        // ── Crear ─────────────────────────────────────────────────────────────
        case 'POST':
            if (empty($body['nombre'])) json_error('El nombre es requerido');
            $stmt = $pdo->prepare('INSERT INTO empresas (nombre,rut,contacto,email,telefono,region,usuarios,cursos,estado) VALUES (?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $body['nombre'],
                $body['rut']      ?? '',
                $body['contacto'] ?? '',
                $body['email']    ?? '',
                $body['telefono'] ?? '',
                $body['region']   ?? '',
                (int)($body['usuarios'] ?? 0),
                (int)($body['cursos']   ?? 0),
                $body['estado']   ?? 'Activa',
            ]);
            $newId = (int)$pdo->lastInsertId();
            $stmt2 = $pdo->prepare('SELECT * FROM empresas WHERE id=?');
            $stmt2->execute([$newId]);
            $row = $stmt2->fetch();
            json_response(row_empresa($row), 201);

        // ── Editar ────────────────────────────────────────────────────────────
        case 'PUT':
            if (!$id) json_error('ID requerido');
            $stmt = $pdo->prepare('UPDATE empresas SET nombre=?,rut=?,contacto=?,email=?,telefono=?,region=?,usuarios=?,cursos=?,estado=? WHERE id=?');
            $stmt->execute([
                $body['nombre'],
                $body['rut']      ?? '',
                $body['contacto'] ?? '',
                $body['email']    ?? '',
                $body['telefono'] ?? '',
                $body['region']   ?? '',
                (int)($body['usuarios'] ?? 0),
                (int)($body['cursos']   ?? 0),
                $body['estado']   ?? 'Activa',
                $id,
            ]);
            $stmt3 = $pdo->prepare('SELECT * FROM empresas WHERE id=?');
            $stmt3->execute([$id]);
            $row = $stmt3->fetch();
            json_response(row_empresa($row));

        // ── Eliminar ──────────────────────────────────────────────────────────
        case 'DELETE':
            if (!$id) json_error('ID requerido');
            $pdo->prepare('DELETE FROM empresas WHERE id=?')->execute([$id]);
            json_response(['ok' => true]);

        default:
            json_error('Método no permitido', 405);
    }
} catch (PDOException $e) {
    error_log('[otec-demo] DB error in ' . basename(__FILE__) . ': ' . $e->getMessage());
    json_error('Error al procesar la solicitud', 500);
}

function row_empresa(array $r): array {
    return [
        'id'       => (int)$r['id'],
        'nombre'   => $r['nombre'],
        'rut'      => $r['rut']      ?? '',
        'contacto' => $r['contacto'] ?? '',
        'email'    => $r['email']    ?? '',
        'telefono' => $r['telefono'] ?? '',
        'region'   => $r['region']   ?? '',
        'usuarios' => (int)($r['usuarios'] ?? 0),
        'cursos'   => (int)($r['cursos']   ?? 0),
        'estado'   => $r['estado']   ?? 'Activa',
        'creadoEn' => $r['creado_en'],
    ];
}
