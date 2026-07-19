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
            // LEFT JOIN con certificados → devuelve el historial embebido en cada persona.
            $page  = isset($_GET['page'])  ? max(1, (int)$_GET['page'])            : null;
            $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : null;

            // GROUP_CONCAT + JSON_OBJECT en vez de JSON_ARRAYAGG: JSON_ARRAYAGG no existe
            // en MariaDB < 10.5 (muchos hostings compartidos aún corren MariaDB), mientras
            // que JSON_OBJECT y GROUP_CONCAT sí están disponibles desde MariaDB 10.2 / MySQL 5.7.
            $pdo->exec('SET SESSION group_concat_max_len = 1000000');

            $baseSql =
                'SELECT p.*,
                    CONCAT(\'[\', COALESCE(GROUP_CONCAT(
                        CASE WHEN c.id IS NOT NULL THEN JSON_OBJECT(
                            \'id\',                c.id,
                            \'codigoCertificado\', c.codigo_certificado,
                            \'curso\',             c.curso,
                            \'empresa\',           c.empresa_nombre,
                            \'empresaId\',         c.empresa_id,
                            \'fechaEmision\',      c.fecha_emision,
                            \'fechaVencimiento\',  c.fecha_vencimiento,
                            \'horas\',             c.horas,
                            \'asistencia\',        c.asistencia,
                            \'evaluacion\',        c.evaluacion,
                            \'estado\',            c.estado
                        ) END SEPARATOR \',\'), \'\'), \']\') AS certs_json
                FROM personas p
                LEFT JOIN certificados c ON c.rut_participante = p.rut
                GROUP BY p.id
                ORDER BY p.nombre';

            if ($page !== null && $limit !== null) {
                $total = (int)$pdo->query('SELECT COUNT(*) FROM personas')->fetchColumn();
                $stmt  = $pdo->prepare($baseSql . ' LIMIT ? OFFSET ?');
                $stmt->execute([$limit, ($page - 1) * $limit]);
                json_response([
                    'data'       => array_map('row_persona', $stmt->fetchAll()),
                    'total'      => $total,
                    'page'       => $page,
                    'limit'      => $limit,
                    'totalPages' => (int)ceil($total / $limit),
                ]);
            }

            $stmt = $pdo->query($baseSql);
            json_response(array_map('row_persona', $stmt->fetchAll()));

        case 'POST':
            if (empty($body['nombre'])) json_error('El nombre es requerido');
            $stmt = $pdo->prepare('INSERT INTO personas (nombre,rut,email,empresa,empresa_id) VALUES (?,?,?,?,?)');
            $stmt->execute([
                $body['nombre'],
                $body['rut']       ?? '',
                $body['email']     ?? '',
                $body['empresa']   ?? '',
                $body['empresaId'] ? (int)$body['empresaId'] : null,
            ]);
            $stmtNew = $pdo->prepare('SELECT * FROM personas WHERE id=?');
            $stmtNew->execute([$pdo->lastInsertId()]);
            $row = $stmtNew->fetch();
            json_response(row_persona($row), 201);

        case 'PUT':
            if (!$id) json_error('ID requerido');
            $stmt = $pdo->prepare('UPDATE personas SET nombre=?,rut=?,email=?,empresa=?,empresa_id=? WHERE id=?');
            $stmt->execute([
                $body['nombre'],
                $body['rut']       ?? '',
                $body['email']     ?? '',
                $body['empresa']   ?? '',
                $body['empresaId'] ? (int)$body['empresaId'] : null,
                $id,
            ]);
            $stmtGet = $pdo->prepare('SELECT * FROM personas WHERE id=?');
            $stmtGet->execute([$id]);
            $row = $stmtGet->fetch();
            json_response(row_persona($row));

        case 'DELETE':
            if (!$id) json_error('ID requerido');
            $stRut = $pdo->prepare('SELECT rut FROM personas WHERE id=?');
            $stRut->execute([$id]);
            $rut = $stRut->fetchColumn();

            $pdo->beginTransaction();
            try {
                if ($rut) {
                    $pdo->prepare('DELETE FROM certificados WHERE rut_participante=?')->execute([$rut]);
                }
                $pdo->prepare('DELETE FROM personas WHERE id=?')->execute([$id]);
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

function row_persona(array $r): array {
    $certs = [];
    if (!empty($r['certs_json'])) {
        $decoded = json_decode($r['certs_json'], true);
        if (is_array($decoded)) {
            foreach ($decoded as $c) {
                if ($c === null) continue;   // LEFT JOIN sin certificado
                $certs[] = [
                    'id'                 => (int)($c['id']                ?? 0),
                    'codigoCertificado'  => $c['codigoCertificado']       ?? '',
                    'curso'              => $c['curso']                    ?? '',
                    'empresa'            => $c['empresa']                  ?? '',
                    'empresaId'          => $c['empresaId'] !== null ? (int)$c['empresaId'] : null,
                    'fechaEmision'       => $c['fechaEmision']             ?? '',
                    'fechaVencimiento'   => $c['fechaVencimiento']         ?? '',
                    'horas'              => (float)($c['horas']              ?? 0),
                    'asistencia'         => (float)($c['asistencia']       ?? 0),
                    'evaluacion'         => (float)($c['evaluacion']       ?? 0),
                    'estado'             => $c['estado']                   ?? '',
                ];
            }
            // Ordenar por fecha de emisión descendente
            usort($certs, fn($a, $b) => strcmp($b['fechaEmision'] ?? '', $a['fechaEmision'] ?? ''));
        }
    }
    return [
        'id'           => (int)$r['id'],
        'nombre'       => $r['nombre']     ?? '',
        'rut'          => $r['rut']        ?? '',
        'email'        => $r['email']      ?? '',
        'empresa'      => $r['empresa']    ?? '',
        'empresaId'    => $r['empresa_id'] ? (int)$r['empresa_id'] : null,
        'creadoEn'     => $r['creado_en']  ?? null,
        'certificados' => $certs,
    ];
}
