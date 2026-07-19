<?php
require_once __DIR__ . '/helpers.php';
cors_headers();
$user = auth_required();
$pdo  = get_pdo();

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id'])  ? (int)$_GET['id'] : null;
$action = $_GET['action']     ?? null;
$body   = ($method === 'POST' || $method === 'PUT') ? get_body() : [];

try {
    // ── Acción especial: generar folio ────────────────────────────────────────
    if ($method === 'GET' && $action === 'folio') {
        $anio = (int)date('Y');
        $stmt = $pdo->prepare("SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(folio,'-',-1) AS UNSIGNED)),0)+1 AS n FROM lotes_certificados WHERE folio LIKE ?");
        $stmt->execute(["$anio-%"]);
        $n     = (int)$stmt->fetchColumn();
        $folio = $anio . '-' . str_pad($n, 4, '0', STR_PAD_LEFT);
        json_response(['folio' => $folio]);
    }

    switch ($method) {
        case 'GET':
            $stmt = $pdo->query('SELECT * FROM lotes_certificados ORDER BY emitido_en DESC');
            json_response(array_map('row_lote', $stmt->fetchAll()));

        case 'POST':
            $stmt = $pdo->prepare('INSERT INTO lotes_certificados (folio,curso_id,plantilla_id,tipo_certificado,cantidad_emitida,participantes_ids,participantes_data,storage_path,emitido_por_id) VALUES (?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $body['folio']            ?? null,
                $body['cursoId']          ? (int)$body['cursoId']      : null,
                $body['plantillaId']      ? (int)$body['plantillaId']  : null,
                $body['tipoCertificado']  ?? 'Aprobación',
                (int)($body['cantidadEmitida']  ?? 0),
                json_encode($body['participantesIds']  ?? []),
                isset($body['participantesData'])
                    ? json_encode($body['participantesData'])
                    : null,
                $body['storagePath']      ?? null,
                $body['emitidoPorId']     ? (int)$body['emitidoPorId'] : null,
            ]);
            $row = $pdo->query('SELECT * FROM lotes_certificados WHERE id=' . $pdo->lastInsertId())->fetch();
            json_response(row_lote($row), 201);

        case 'PUT':
            if (!$id) json_error('ID requerido');
            $stmt = $pdo->prepare('UPDATE lotes_certificados SET folio=?,curso_id=?,plantilla_id=?,tipo_certificado=?,cantidad_emitida=?,participantes_ids=?,participantes_data=?,storage_path=?,emitido_por_id=? WHERE id=?');
            $stmt->execute([
                $body['folio']            ?? null,
                $body['cursoId']          ? (int)$body['cursoId']      : null,
                $body['plantillaId']      ? (int)$body['plantillaId']  : null,
                $body['tipoCertificado']  ?? 'Aprobación',
                (int)($body['cantidadEmitida']  ?? 0),
                json_encode($body['participantesIds']  ?? []),
                isset($body['participantesData'])
                    ? json_encode($body['participantesData'])
                    : null,
                $body['storagePath']      ?? null,
                $body['emitidoPorId']     ? (int)$body['emitidoPorId'] : null,
                $id,
            ]);
            $stmt2 = $pdo->prepare('SELECT * FROM lotes_certificados WHERE id=?');
            $stmt2->execute([$id]);
            $row = $stmt2->fetch();
            json_response(row_lote($row));

        case 'DELETE':
            if (!$id) json_error('ID requerido');
            $stFolio = $pdo->prepare('SELECT folio FROM lotes_certificados WHERE id=?');
            $stFolio->execute([$id]);
            $folio = $stFolio->fetchColumn();

            $pdo->beginTransaction();
            try {
                if ($folio) {
                    $pdo->prepare('DELETE FROM certificados WHERE folio=?')->execute([$folio]);
                }
                $pdo->prepare('DELETE FROM lotes_certificados WHERE id=?')->execute([$id]);
                $pdo->commit();
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            json_response(['ok' => true]);

        default:
            json_error('Método no permitido', 405);
    }
} catch (PDOException $e) {
    error_log('[otec-demo] DB error in ' . basename(__FILE__) . ': ' . $e->getMessage());
    json_error('Error al procesar la solicitud', 500);
}

function row_lote(array $r): array {
    return [
        'id'               => (int)$r['id'],
        'folio'            => $r['folio'],
        'cursoId'          => $r['curso_id']         ? (int)$r['curso_id']        : null,
        'plantillaId'      => $r['plantilla_id']     ? (int)$r['plantilla_id']    : null,
        'tipoCertificado'  => $r['tipo_certificado'] ?? 'Aprobación',
        'cantidadEmitida'  => (int)($r['cantidad_emitida']  ?? 0),
        'participantesIds' => json_decode($r['participantes_ids'] ?? '[]', true) ?? [],
        'participantesData'=> !empty($r['participantes_data'])
                                ? json_decode($r['participantes_data'], true)
                                : null,
        'storagePath'      => $r['storage_path']     ?? null,
        'emitidoPorId'     => $r['emitido_por_id']   ? (int)$r['emitido_por_id']  : null,
        'emitidoEn'        => $r['emitido_en'],
    ];
}
