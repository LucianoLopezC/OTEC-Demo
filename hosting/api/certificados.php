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
            $action = $_GET['action'] ?? '';

            // ── Generar N códigos únicos (batch SELECT — O(1) queries) ────────
            if ($action === 'generar_codigos') {
                $n          = max(1, min((int)($_GET['cantidad'] ?? 1), 500));
                $codigos    = [];
                $maxRondas  = 6;

                for ($ronda = 0; count($codigos) < $n && $ronda < $maxRondas; $ronda++) {
                    // Generar 2× candidatos para minimizar rondas necesarias
                    $faltan     = ($n - count($codigos)) * 2;
                    $candidatos = [];
                    for ($i = 0; $i < $faltan; $i++) {
                        $candidatos[] = gen_codigo_cert();
                    }
                    $candidatos = array_values(array_unique($candidatos));
                    if (empty($candidatos)) continue;

                    // Un solo SELECT para verificar todos los candidatos
                    $ph = implode(',', array_fill(0, count($candidatos), '?'));
                    $st = $pdo->prepare("SELECT codigo_certificado FROM certificados WHERE codigo_certificado IN ($ph)");
                    $st->execute($candidatos);
                    $existentes = array_flip(array_column($st->fetchAll(), 'codigo_certificado'));

                    foreach ($candidatos as $c) {
                        if (!isset($existentes[$c])) {
                            $codigos[] = $c;
                            if (count($codigos) >= $n) break;
                        }
                    }
                }
                json_response(['codigos' => $codigos]);
            }

            // ── Buscar un certificado por código (panel admin) ────────────────
            if ($action === 'buscar') {
                $codigo = strtoupper(trim($_GET['codigo'] ?? ''));
                if (!$codigo) json_error('Código requerido');
                $st = $pdo->prepare('SELECT * FROM certificados WHERE UPPER(codigo_certificado) = ?');
                $st->execute([$codigo]);
                $row = $st->fetch();
                json_response($row ? row_certificado($row) : null);
            }

            // ── Datos completos para regenerar PDF al vuelo ───────────────────
            if ($action === 'datos_regeneracion') {
                $codigo = strtoupper(trim($_GET['codigo'] ?? ''));
                if (!$codigo) json_error('Código requerido');
                $st = $pdo->prepare(
                    'SELECT c.*,
                            cu.nombre           AS cur_nombre,
                            cu.codigo_sence     AS cur_codigo_sence,
                            cu.horas            AS cur_horas,
                            cu.modalidad        AS cur_modalidad,
                            cu.condicion        AS cur_condicion,
                            cu.contenidos       AS cur_contenidos,
                            cu.vigencia_meses   AS cur_vigencia_meses,
                            cu.plantilla_id     AS cur_plantilla_id,
                            p.storage_path      AS plt_storage_path,
                            p.nombre            AS plt_nombre,
                            p.tipo              AS plt_tipo
                     FROM certificados c
                     LEFT JOIN cursos cu ON cu.id = c.curso_id
                     LEFT JOIN plantillas p ON p.id = cu.plantilla_id
                     WHERE UPPER(c.codigo_certificado) = ?'
                );
                $st->execute([$codigo]);
                $row = $st->fetch();
                if (!$row) json_response(null);
                json_response(row_certificado_completo($row));
            }

            // ── Listado por folio (para regenerar ZIP del lote) ──────────────
            $folio = trim($_GET['folio'] ?? '');
            if ($folio) {
                $stmt = $pdo->prepare(
                    'SELECT * FROM certificados WHERE folio = ? ORDER BY nombre_participante ASC'
                );
                $stmt->execute([$folio]);
                json_response(array_map('row_certificado', $stmt->fetchAll()));
            }

            // ── Listado con paginación opcional (para exportar / cargar datos) ──
            $page  = max(1, (int)($_GET['page']  ?? 0));
            $limit = max(1, min((int)($_GET['limit'] ?? 0), 500));

            if ($page > 0 && $limit > 0) {
                // Paginado: GET certificados.php?page=1&limit=100
                $offset = ($page - 1) * $limit;
                $stCount = $pdo->query('SELECT COUNT(*) FROM certificados');
                $total   = (int)$stCount->fetchColumn();
                $stmt = $pdo->prepare('SELECT * FROM certificados ORDER BY fecha_emision DESC LIMIT ? OFFSET ?');
                $stmt->execute([$limit, $offset]);
                json_response([
                    'data'       => array_map('row_certificado', $stmt->fetchAll()),
                    'total'      => $total,
                    'page'       => $page,
                    'limit'      => $limit,
                    'totalPages' => (int)ceil($total / $limit),
                ]);
            }

            // Sin paginación — devuelve todo (compatibilidad con exportación Sheets)
            $stmt = $pdo->query('SELECT * FROM certificados ORDER BY fecha_emision DESC');
            json_response(array_map('row_certificado', $stmt->fetchAll()));

        case 'POST':
            $action = $_GET['action'] ?? '';

            // ── Inserción masiva en una sola transacción ──────────────────────
            if ($action === 'bulk_crear') {
                $certs          = $body['certificados']    ?? [];
                $personasNuevas = $body['personasNuevas']  ?? [];
                $cursoId        = !empty($body['cursoId']) ? (int)$body['cursoId'] : null;
                $cantAprobados  = (int)($body['cantidadAprobados'] ?? 0);

                if (empty($certs)) json_error('Sin certificados');

                $pdo->beginTransaction();
                try {
                    // 1. Insertar todos los certificados
                    $stCert = $pdo->prepare(
                        'INSERT INTO certificados
                         (codigo_certificado,curso,curso_id,empresa_id,empresa_nombre,
                          nombre_participante,rut_participante,fecha_emision,
                          fecha_vencimiento,horas,asistencia,evaluacion,estado,persona_id,
                          folio,cargo_participante,fecha_inicio_curso,fecha_termino_curso,
                          lugar_ejecucion,condicion)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
                    );
                    foreach ($certs as $c) {
                        $params = [
                            $c['codigoCertificado']   ?? null,
                            $c['curso']               ?? '',
                            !empty($c['cursoId'])     ? (int)$c['cursoId']    : null,
                            !empty($c['empresaId'])   ? (int)$c['empresaId']  : null,
                            $c['empresaNombre']       ?? '',
                            $c['nombreParticipante']  ?? $c['nombre'] ?? '',
                            $c['rutParticipante']     ?? $c['rut']    ?? '',
                            $c['fechaEmision']        ?: null,
                            !empty($c['fechaVencimiento']) ? $c['fechaVencimiento'] : null,
                            (float)($c['horas']       ?? 0),
                            (float)($c['asistencia']  ?? 0),
                            (float)($c['evaluacion']  ?? 0),
                            $c['estado']              ?? 'Vigente',
                            null,
                            $c['folio']               ?? null,
                            $c['cargoParticipante']   ?? '',
                            $c['fechaInicioCurso']    ?: null,
                            $c['fechaTerminoCurso']   ?: null,
                            $c['lugarEjecucion']      ?? '',
                            $c['condicion']           ?? '',
                        ];
                        insert_cert_retrying($stCert, $pdo, $params);
                    }

                    // 2. Crear personas nuevas (el front filtra las que ya existen)
                    if (!empty($personasNuevas)) {
                        $stChkRut    = $pdo->prepare('SELECT id FROM personas WHERE rut = ? AND rut != \'\' LIMIT 1');
                        $stChkNombre = $pdo->prepare('SELECT id FROM personas WHERE LOWER(nombre) = LOWER(?) LIMIT 1');
                        $stInsP      = $pdo->prepare(
                            'INSERT INTO personas (nombre,rut,email,empresa,empresa_id) VALUES (?,?,?,?,?)'
                        );
                        foreach ($personasNuevas as $p) {
                            $existe = false;
                            if (!empty($p['rut'])) {
                                $stChkRut->execute([$p['rut']]);
                                $existe = (bool)$stChkRut->fetchColumn();
                            }
                            if (!$existe) {
                                $stChkNombre->execute([$p['nombre']]);
                                $existe = (bool)$stChkNombre->fetchColumn();
                            }
                            if (!$existe) {
                                $stInsP->execute([
                                    $p['nombre'],
                                    $p['rut']       ?? '',
                                    $p['email']     ?? '',
                                    $p['empresa']   ?? '',
                                    !empty($p['empresaId']) ? (int)$p['empresaId'] : null,
                                ]);
                            }
                        }
                    }

                    // 3. Actualizar total_emisiones de forma atómica (sin race condition)
                    if ($cursoId && $cantAprobados > 0) {
                        $pdo->prepare(
                            'UPDATE cursos SET total_emisiones = total_emisiones + ? WHERE id = ?'
                        )->execute([$cantAprobados, $cursoId]);
                    }

                    $pdo->commit();
                    json_response(['ok' => true, 'insertados' => count($certs)], 201);

                } catch (Exception $e) {
                    $pdo->rollBack();
                    throw $e;
                }
            }

            // ── Inserción individual (mantener compatibilidad) ─────────────────
            $stmt = $pdo->prepare(
                'INSERT INTO certificados
                 (codigo_certificado,curso,curso_id,empresa_id,empresa_nombre,
                  nombre_participante,rut_participante,fecha_emision,
                  fecha_vencimiento,horas,asistencia,evaluacion,estado,persona_id,
                  folio,cargo_participante,fecha_inicio_curso,fecha_termino_curso,
                  lugar_ejecucion,condicion)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
            );
            insert_cert_retrying($stmt, $pdo, [
                $body['codigoCertificado']  ?? null,
                $body['curso']              ?? '',
                !empty($body['cursoId'])    ? (int)$body['cursoId']   : null,
                !empty($body['empresaId'])  ? (int)$body['empresaId'] : null,
                $body['empresaNombre']      ?? '',
                $body['nombreParticipante'] ?? $body['nombre'] ?? '',
                $body['rutParticipante']    ?? $body['rut']    ?? '',
                $body['fechaEmision']       ?: null,
                $body['fechaVencimiento']   ?: null,
                (float)($body['horas']      ?? 0),
                (float)($body['asistencia'] ?? 0),
                (float)($body['evaluacion'] ?? 0),
                $body['estado']             ?? 'Vigente',
                !empty($body['personaId'])  ? (int)$body['personaId'] : null,
                $body['folio']              ?? null,
                $body['cargoParticipante']  ?? '',
                $body['fechaInicioCurso']   ?: null,
                $body['fechaTerminoCurso']  ?: null,
                $body['lugarEjecucion']     ?? '',
                $body['condicion']          ?? '',
            ]);
            $newId = (int)$pdo->lastInsertId();
            $stmt2 = $pdo->prepare('SELECT * FROM certificados WHERE id=?');
            $stmt2->execute([$newId]);
            $row = $stmt2->fetch();
            json_response(row_certificado($row), 201);

        case 'PUT':
            if (!$id) json_error('ID requerido');
            $stmt = $pdo->prepare(
                'UPDATE certificados
                 SET codigo_certificado=?,curso=?,empresa_id=?,empresa_nombre=?,
                     nombre_participante=?,rut_participante=?,fecha_emision=?,
                     fecha_vencimiento=?,horas=?,asistencia=?,evaluacion=?,estado=?,persona_id=?
                 WHERE id=?'
            );
            $stmt->execute([
                $body['codigoCertificado']  ?? null,
                $body['curso']              ?? '',
                $body['empresaId']          ? (int)$body['empresaId'] : null,
                $body['empresaNombre']      ?? '',
                $body['nombreParticipante'] ?? $body['nombre'] ?? '',
                $body['rutParticipante']    ?? $body['rut']    ?? '',
                $body['fechaEmision']       ?: null,
                $body['fechaVencimiento']   ?: null,
                (float)($body['horas']        ?? 0),
                (float)($body['asistencia'] ?? 0),
                (float)($body['evaluacion'] ?? 0),
                $body['estado']             ?? 'Vigente',
                $body['personaId']          ? (int)$body['personaId'] : null,
                $id,
            ]);
            $stmt3 = $pdo->prepare('SELECT * FROM certificados WHERE id=?');
            $stmt3->execute([$id]);
            $row = $stmt3->fetch();
            json_response(row_certificado($row));

        case 'DELETE':
            if (!$id) json_error('ID requerido');
            $pdo->prepare('DELETE FROM certificados WHERE id=?')->execute([$id]);
            json_response(['ok' => true]);

        default:
            json_error('Método no permitido', 405);
    }
} catch (PDOException $e) {
    error_log('[otec-demo] DB error in ' . basename(__FILE__) . ': ' . $e->getMessage());
    json_error('Error al procesar la solicitud', 500);
}

// Genera un código con formato CERT-YYYY-LLLL-NNNN
function gen_codigo_cert(): string {
    $anio   = date('Y');
    $chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    $letras = '';
    for ($i = 0; $i < 4; $i++) {
        $letras .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return 'CERT-' . $anio . '-' . $letras . '-' . random_int(1000, 9999);
}

// Genera un código garantizando que no exista en BD (para el retry de la race condition)
function gen_codigo_cert_unique(PDO $pdo): string {
    $st = $pdo->prepare('SELECT 1 FROM certificados WHERE codigo_certificado = ? LIMIT 1');
    for ($i = 0; $i < 30; $i++) {
        $c = gen_codigo_cert();
        $st->execute([$c]);
        if (!$st->fetch()) return $c;
    }
    throw new RuntimeException('No se pudo generar un código único tras 30 intentos');
}

// Ejecuta el INSERT; si choca con el UNIQUE (race condition), remplaza el código y reintenta
function insert_cert_retrying(PDOStatement $stmt, PDO $pdo, array $params): void {
    try {
        $stmt->execute($params);
    } catch (PDOException $e) {
        if ((int)$e->errorInfo[1] !== 1062) throw $e; // solo manejamos duplicate entry
        $params[0] = gen_codigo_cert_unique($pdo);
        $stmt->execute($params); // si vuelve a fallar, propaga la excepción
    }
}

function row_certificado(array $r): array {
    return [
        'id'                 => (int)$r['id'],
        'codigoCertificado'  => $r['codigo_certificado'],
        'curso'              => $r['curso']               ?? '',
        'cursoId'            => $r['curso_id']            ? (int)$r['curso_id'] : null,
        'empresaId'          => $r['empresa_id']          ? (int)$r['empresa_id'] : null,
        'empresaNombre'      => $r['empresa_nombre']      ?? '',
        'empresa'            => $r['empresa_nombre']      ?? '',
        'nombre'             => $r['nombre_participante'] ?? '',
        'nombreParticipante' => $r['nombre_participante'] ?? '',
        'rut'                => $r['rut_participante']    ?? '',
        'rutParticipante'    => $r['rut_participante']    ?? '',
        'fechaEmision'       => $r['fecha_emision']       ?? '',
        'fechaVencimiento'   => $r['fecha_vencimiento']   ?? '',
        'horas'              => (float)($r['horas']       ?? 0),
        'asistencia'         => (float)($r['asistencia']  ?? 0),
        'evaluacion'         => (float)($r['evaluacion']  ?? 0),
        'estado'             => $r['estado']              ?? 'Vigente',
        'personaId'          => $r['persona_id']          ? (int)$r['persona_id'] : null,
        'folio'              => $r['folio']               ?? '',
        'cargoParticipante'  => $r['cargo_participante']  ?? '',
        'fechaInicioCurso'   => $r['fecha_inicio_curso']  ?? '',
        'fechaTerminoCurso'  => $r['fecha_termino_curso'] ?? '',
        'lugarEjecucion'     => $r['lugar_ejecucion']     ?? '',
        'condicion'          => $r['condicion']           ?? '',
    ];
}

function row_certificado_completo(array $r): array {
    $base = row_certificado($r);
    $base['curso_datos'] = [
        'nombre'        => $r['cur_nombre']        ?? $r['curso'] ?? '',
        'codigoSence'   => $r['cur_codigo_sence']  ?? '',
        'horas'         => (float)($r['cur_horas']        ?? $r['horas'] ?? 0),
        'modalidad'     => $r['cur_modalidad']     ?? '',
        'condicion'     => $r['cur_condicion']     ?? $r['condicion'] ?? '',
        'contenidos'    => $r['cur_contenidos']    ?? '',
        'vigenciaMeses' => (int)($r['cur_vigencia_meses'] ?? 12),
        'plantillaId'   => $r['cur_plantilla_id']  ? (int)$r['cur_plantilla_id'] : null,
    ];
    $base['plantilla_datos'] = $r['cur_plantilla_id'] ? [
        'storagePath' => $r['plt_storage_path'] ?? null,
        'nombre'      => $r['plt_nombre']       ?? '',
        'tipo'        => $r['plt_tipo']         ?? '',
    ] : null;
    return $base;
}
