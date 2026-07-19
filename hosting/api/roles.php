<?php
require_once __DIR__ . '/helpers.php';
cors_headers();
$user = auth_required();
$pdo  = get_pdo();

const SISTEMA_IDS = ['superadmin', 'operador', 'empresa'];

$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? null;   // id es string (ej: 'superadmin' o UUID)
$body   = ($method === 'POST' || $method === 'PUT') ? get_body() : [];

try {
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query('SELECT * FROM roles ORDER BY nombre');
            json_response(array_map('row_rol', $stmt->fetchAll()));

        case 'POST':
            require_permission($pdo, $user, 'gestionarRoles');
            if (empty($body['nombre'])) json_error('El nombre es requerido');
            $newId = $body['id'] ?? uniqid('rol_', true);
            $stmt  = $pdo->prepare('INSERT INTO roles (id,nombre,descripcion,color,permisos) VALUES (?,?,?,?,?)');
            $stmt->execute([
                $newId,
                $body['nombre'],
                $body['descripcion'] ?? '',
                $body['color']       ?? 'brand',
                json_encode($body['permisos'] ?? []),
            ]);
            $row = $pdo->prepare('SELECT * FROM roles WHERE id=?');
            $row->execute([$newId]);
            json_response(row_rol($row->fetch()), 201);

        case 'PUT':
            require_permission($pdo, $user, 'gestionarRoles');
            if (!$id) json_error('ID requerido');
            $stmt = $pdo->prepare('
                INSERT INTO roles (id, nombre, descripcion, color, permisos)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    nombre=VALUES(nombre),
                    descripcion=VALUES(descripcion),
                    color=VALUES(color),
                    permisos=VALUES(permisos)
            ');
            $stmt->execute([
                $id,
                $body['nombre'],
                $body['descripcion'] ?? '',
                $body['color']       ?? 'brand',
                json_encode($body['permisos'] ?? []),
            ]);
            $row = $pdo->prepare('SELECT * FROM roles WHERE id=?');
            $row->execute([$id]);
            json_response(row_rol($row->fetch()));

        case 'DELETE':
            require_permission($pdo, $user, 'gestionarRoles');
            if (!$id) json_error('ID requerido');
            if (in_array($id, SISTEMA_IDS, true)) json_error('No se pueden eliminar roles de sistema', 403);
            $pdo->prepare('DELETE FROM roles WHERE id=?')->execute([$id]);
            json_response(['ok' => true]);

        default:
            json_error('Método no permitido', 405);
    }
} catch (PDOException $e) {
    error_log('[otec-demo] DB error in ' . basename(__FILE__) . ': ' . $e->getMessage());
    json_error('Error al procesar la solicitud', 500);
}

function row_rol(array $r): array {
    return [
        'id'          => $r['id'],
        'nombre'      => $r['nombre'],
        'descripcion' => $r['descripcion'] ?? '',
        'color'       => $r['color']       ?? 'brand',
        'permisos'    => json_decode($r['permisos'] ?? '{}', true) ?? [],
        'sistema'     => in_array($r['id'], SISTEMA_IDS),
        'creadoEn'    => $r['creado_en'],
    ];
}
