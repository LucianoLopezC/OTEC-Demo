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
            $stmt = $pdo->query('SELECT * FROM cursos ORDER BY nombre');
            json_response(array_map('row_curso', $stmt->fetchAll()));

        case 'POST':
            if (empty($body['nombre'])) json_error('El nombre es requerido');
            $stmt = $pdo->prepare('INSERT INTO cursos (nombre,codigo_sence,horas,condicion,modalidad,categorias,objetivos,contenidos,estado,plantilla_id,vigencia_meses,precio,total_emisiones,porcentaje_asistencia,porcentaje_aprobacion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $body['nombre'],
                $body['codigoSence']          ?? '',
                (float)($body['horas']          ?? 0),
                $body['condicion']            ?? '',
                $body['modalidad']            ?? null,
                json_encode($body['categorias'] ?? []),
                $body['objetivos']            ?? '',
                $body['contenidos']           ?? '',
                $body['estado']               ?? 'Activo',
                $body['plantillaId']          ? (int)$body['plantillaId'] : null,
                (int)($body['vigenciaMeses']    ?? 12),
                isset($body['precio']) && $body['precio'] !== '' ? (float)$body['precio'] : null,
                (int)($body['totalEmisiones']   ?? 0),
                isset($body['porcentajeAsistencia']) && $body['porcentajeAsistencia'] !== '' ? (int)$body['porcentajeAsistencia'] : null,
                isset($body['porcentajeAprobacion']) && $body['porcentajeAprobacion'] !== '' ? (int)$body['porcentajeAprobacion'] : null,
            ]);
            $newId = (int)$pdo->lastInsertId();
            $stmt2 = $pdo->prepare('SELECT * FROM cursos WHERE id=?');
            $stmt2->execute([$newId]);
            $row = $stmt2->fetch();
            json_response(row_curso($row), 201);

        case 'PUT':
            if (!$id) json_error('ID requerido');
            $stmt = $pdo->prepare('UPDATE cursos SET nombre=?,codigo_sence=?,horas=?,condicion=?,modalidad=?,categorias=?,objetivos=?,contenidos=?,estado=?,plantilla_id=?,vigencia_meses=?,precio=?,total_emisiones=?,porcentaje_asistencia=?,porcentaje_aprobacion=?,actualizado_en=NOW() WHERE id=?');
            $stmt->execute([
                $body['nombre'],
                $body['codigoSence']          ?? '',
                (float)($body['horas']          ?? 0),
                $body['condicion']            ?? '',
                $body['modalidad']            ?? null,
                json_encode($body['categorias'] ?? []),
                $body['objetivos']            ?? '',
                $body['contenidos']           ?? '',
                $body['estado']               ?? 'Activo',
                $body['plantillaId']          ? (int)$body['plantillaId'] : null,
                (int)($body['vigenciaMeses']    ?? 12),
                isset($body['precio']) && $body['precio'] !== '' ? (float)$body['precio'] : null,
                (int)($body['totalEmisiones']   ?? 0),
                isset($body['porcentajeAsistencia']) && $body['porcentajeAsistencia'] !== '' ? (int)$body['porcentajeAsistencia'] : null,
                isset($body['porcentajeAprobacion']) && $body['porcentajeAprobacion'] !== '' ? (int)$body['porcentajeAprobacion'] : null,
                $id,
            ]);
            $stmt3 = $pdo->prepare('SELECT * FROM cursos WHERE id=?');
            $stmt3->execute([$id]);
            $row = $stmt3->fetch();
            json_response(row_curso($row));

        case 'DELETE':
            if (!$id) json_error('ID requerido');
            $pdo->prepare('DELETE FROM cursos WHERE id=?')->execute([$id]);
            json_response(['ok' => true]);

        default:
            json_error('Método no permitido', 405);
    }
} catch (PDOException $e) {
    error_log('[otec-demo] DB error in ' . basename(__FILE__) . ': ' . $e->getMessage());
    json_error('Error al procesar la solicitud', 500);
}

function row_curso(array $r): array {
    return [
        'id'             => (int)$r['id'],
        'nombre'         => $r['nombre'],
        'codigoSence'    => $r['codigo_sence']    ?? '',
        'horas'          => (float)($r['horas']      ?? 0),
        'condicion'      => $r['condicion']        ?? '',
        'modalidad'      => $r['modalidad'],
        'categorias'     => json_decode($r['categorias'] ?? '[]', true) ?? [],
        'objetivos'      => $r['objetivos']        ?? '',
        'contenidos'     => $r['contenidos']       ?? '',
        'estado'         => $r['estado']           ?? 'Activo',
        'plantillaId'    => $r['plantilla_id']     ? (int)$r['plantilla_id'] : null,
        'vigenciaMeses'  => (int)($r['vigencia_meses'] ?? 12),
        'precio'         => $r['precio'] !== null  ? (float)$r['precio'] : '',
        'totalEmisiones'       => (int)($r['total_emisiones'] ?? 0),
        'porcentajeAsistencia' => $r['porcentaje_asistencia'] !== null ? (int)$r['porcentaje_asistencia'] : null,
        'porcentajeAprobacion' => $r['porcentaje_aprobacion'] !== null ? (int)$r['porcentaje_aprobacion'] : null,
        'creadoEn'             => $r['creado_en'],
        'actualizadoEn'        => $r['actualizado_en'],
    ];
}
