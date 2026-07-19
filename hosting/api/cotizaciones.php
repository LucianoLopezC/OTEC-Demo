<?php
require_once __DIR__ . '/helpers.php';
cors_headers();
$user = auth_required();
$pdo  = get_pdo();

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$body   = ($method === 'POST' || $method === 'PUT') ? get_body() : [];

function row_cotizacion(array $row): array {
    return [
        'id'              => (int)$row['id'],
        'numero'          => $row['numero'],
        'empresaId'       => $row['empresa_id'] ? (int)$row['empresa_id'] : null,
        'empresaNombre'   => $row['empresa_nombre'],
        'empresaRut'      => $row['empresa_rut'],
        'empresaContacto' => $row['empresa_contacto'],
        'fecha'           => $row['fecha'],
        'items'           => json_decode($row['items'], true),
        'subtotal'        => (float)$row['subtotal'],
        'notas'           => $row['notas'],
        'estado'          => $row['estado'],
        'createdAt'       => $row['created_at'],
    ];
}

try {
    switch ($method) {
        case 'GET':
            if (isset($_GET['next'])) {
                $year = (int)date('Y');
                $stmt = $pdo->prepare('SELECT numero FROM cotizaciones WHERE numero LIKE ? ORDER BY id DESC LIMIT 500');
                $stmt->execute(["%{$year}"]);
                $rows = $stmt->fetchAll();
                $max  = 0;
                foreach ($rows as $r) {
                    if (preg_match('/(\d+)-\d{4}$/', $r['numero'], $m)) {
                        $max = max($max, (int)$m[1]);
                    }
                }
                json_response(['next' => $max + 1]);
            }
            if (isset($_GET['claim'])) {
                $year = (int)date('Y');
                $pdo->exec('LOCK TABLES cotizaciones WRITE');
                try {
                    $stmt = $pdo->prepare('SELECT numero FROM cotizaciones WHERE numero LIKE ? ORDER BY id DESC LIMIT 500');
                    $stmt->execute(["%{$year}"]);
                    $rows = $stmt->fetchAll();
                    $max  = 0;
                    foreach ($rows as $r) {
                        if (preg_match('/(\d+)-\d{4}$/', $r['numero'], $m)) {
                            $max = max($max, (int)$m[1]);
                        }
                    }
                    $numero = sprintf('%03d', $max + 1) . '-' . $year;
                    $stmt = $pdo->prepare(
                        'INSERT INTO cotizaciones (numero, empresa_nombre, fecha, items, subtotal, estado) VALUES (?, "", ?, "[]", 0, "reservada")'
                    );
                    $stmt->execute([$numero, date('Y-m-d')]);
                    $reservedId = (int)$pdo->lastInsertId();
                    $pdo->exec('UNLOCK TABLES');
                    json_response(['numero' => $numero, 'id' => $reservedId]);
                } catch (\Exception $e) {
                    $pdo->exec('UNLOCK TABLES');
                    json_error('Error al reservar número: ' . $e->getMessage(), 500);
                }
            }
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM cotizaciones WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if (!$row) json_error('Cotización no encontrada', 404);
                json_response(row_cotizacion($row));
            }
            $numero = $_GET['numero'] ?? '';
            $search = $_GET['q']      ?? '';
            if ($numero) {
                $stmt = $pdo->prepare('SELECT * FROM cotizaciones WHERE numero = ?');
                $stmt->execute([$numero]);
                $row = $stmt->fetch();
                if (!$row) json_error('Cotización no encontrada', 404);
                json_response(row_cotizacion($row));
            }
            if ($search) {
                $like = "%{$search}%";
                $stmt = $pdo->prepare('SELECT * FROM cotizaciones WHERE numero LIKE ? OR empresa_nombre LIKE ? ORDER BY created_at DESC LIMIT 100');
                $stmt->execute([$like, $like]);
            } else {
                $stmt = $pdo->query('SELECT * FROM cotizaciones ORDER BY created_at DESC LIMIT 100');
            }
            json_response(array_map('row_cotizacion', $stmt->fetchAll()));

        case 'POST':
            if (empty($body['numero']))        json_error('Número requerido');
            if (empty($body['empresaNombre'])) json_error('Empresa requerida');
            $stmt = $pdo->prepare(
                'INSERT INTO cotizaciones
                 (numero, empresa_id, empresa_nombre, empresa_rut, empresa_contacto, fecha, items, subtotal, notas, estado)
                 VALUES (?,?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $body['numero'],
                isset($body['empresaId']) && $body['empresaId'] ? (int)$body['empresaId'] : null,
                $body['empresaNombre'],
                $body['empresaRut']      ?? null,
                $body['empresaContacto'] ?? null,
                $body['fecha'],
                json_encode($body['items'] ?? [], JSON_UNESCAPED_UNICODE),
                (float)($body['subtotal'] ?? 0),
                $body['notas'] ?: null,
                $body['estado'] ?? 'emitida',
            ]);
            $newId = (int)$pdo->lastInsertId();
            $stmt2 = $pdo->prepare('SELECT * FROM cotizaciones WHERE id = ?');
            $stmt2->execute([$newId]);
            json_response(row_cotizacion($stmt2->fetch()), 201);

        case 'PUT':
            if (!$id) json_error('ID requerido');
            if (isset($body['empresaNombre'])) {
                $stmt = $pdo->prepare(
                    'UPDATE cotizaciones SET empresa_id=?, empresa_nombre=?, empresa_rut=?, empresa_contacto=?,
                     fecha=?, items=?, subtotal=?, notas=?, estado=? WHERE id=?'
                );
                $stmt->execute([
                    isset($body['empresaId']) && $body['empresaId'] ? (int)$body['empresaId'] : null,
                    $body['empresaNombre'],
                    $body['empresaRut']      ?? null,
                    $body['empresaContacto'] ?? null,
                    $body['fecha'],
                    json_encode($body['items'] ?? [], JSON_UNESCAPED_UNICODE),
                    (float)($body['subtotal'] ?? 0),
                    $body['notas'] ?: null,
                    $body['estado'] ?? 'emitida',
                    $id,
                ]);
            } else {
                $stmt = $pdo->prepare('UPDATE cotizaciones SET estado = ? WHERE id = ?');
                $stmt->execute([$body['estado'] ?? 'emitida', $id]);
            }
            $stmt2 = $pdo->prepare('SELECT * FROM cotizaciones WHERE id = ?');
            $stmt2->execute([$id]);
            json_response(row_cotizacion($stmt2->fetch()));

        case 'DELETE':
            if (!$id) json_error('ID requerido');
            $pdo->prepare('DELETE FROM cotizaciones WHERE id = ?')->execute([$id]);
            json_response(null, 204);

        default:
            json_error('Método no permitido', 405);
    }
} catch (PDOException $e) {
    json_error('Error de base de datos: ' . $e->getMessage(), 500);
}
