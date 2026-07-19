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
        case 'GET':
            $stmt = $pdo->query('SELECT * FROM plantillas ORDER BY nombre');
            json_response(array_map('row_plantilla', $stmt->fetchAll()));

        case 'POST':
            if (empty($body['nombre'])) json_error('El nombre es requerido');
            $stmt = $pdo->prepare('INSERT INTO plantillas (nombre,descripcion,tipo,categoria,storage_path,nombre_archivo) VALUES (?,?,?,?,?,?)');
            $stmt->execute([
                $body['nombre'],
                $body['descripcion']   ?? '',
                $body['tipo']          ?? 'Aprobación',
                $body['categoria']     ?? 'certificado',
                $body['storagePath']   ?? null,
                $body['nombreArchivo'] ?? '',
            ]);
            $newId = (int)$pdo->lastInsertId();
            $stmt2 = $pdo->prepare('SELECT * FROM plantillas WHERE id=?');
            $stmt2->execute([$newId]);
            $row = $stmt2->fetch();
            json_response(row_plantilla($row), 201);

        case 'PUT':
            if (!$id) json_error('ID requerido');
            $stmt = $pdo->prepare('UPDATE plantillas SET nombre=?,descripcion=?,tipo=?,categoria=?,storage_path=?,nombre_archivo=?,actualizado_en=NOW() WHERE id=?');
            $stmt->execute([
                $body['nombre'],
                $body['descripcion']   ?? '',
                $body['tipo']          ?? 'Aprobación',
                $body['categoria']     ?? 'certificado',
                $body['storagePath']   ?? null,
                $body['nombreArchivo'] ?? '',
                $id,
            ]);
            $stmt3 = $pdo->prepare('SELECT * FROM plantillas WHERE id=?');
            $stmt3->execute([$id]);
            $row = $stmt3->fetch();
            json_response(row_plantilla($row));

        case 'DELETE':
            if (!$id) json_error('ID requerido');
            $pdo->prepare('DELETE FROM plantillas WHERE id=?')->execute([$id]);
            json_response(['ok' => true]);

        default:
            json_error('Método no permitido', 405);
    }
} catch (PDOException $e) {
    error_log('[otec-demo] DB error in ' . basename(__FILE__) . ': ' . $e->getMessage());
    json_error('Error al procesar la solicitud', 500);
}

function row_plantilla(array $r): array {
    return [
        'id'            => (int)$r['id'],
        'nombre'        => $r['nombre'],
        'descripcion'   => $r['descripcion']   ?? '',
        'tipo'          => $r['tipo']           ?? 'Aprobación',
        'categoria'     => $r['categoria']      ?? 'certificado',
        'storagePath'   => $r['storage_path'],
        'nombreArchivo' => $r['nombre_archivo'] ?? '',
        'creadoEn'      => $r['creado_en'],
        'actualizadoEn' => $r['actualizado_en'],
    ];
}
