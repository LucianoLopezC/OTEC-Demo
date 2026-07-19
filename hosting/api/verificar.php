<?php
// ════════════════════════════════════════════════════════════════════════════
// verificar.php — Verificación pública de certificados (sin autenticación)
// GET /api/verificar.php?codigo=CERT-2026-XXXX-0000
// Usado por la pantalla /verify y los QR de los certificados.
// ════════════════════════════════════════════════════════════════════════════

require_once __DIR__ . '/helpers.php';
cors_headers();
// Sobrescribir CORS para permitir cualquier origen (QR desde celular, apps externas)
header('Access-Control-Allow-Origin: *');
// Sin auth_required() — debe ser accesible sin sesión activa

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Método no permitido', 405);

$codigo = strtoupper(trim($_GET['codigo'] ?? ''));
if (!$codigo) json_error('Código requerido');

try {
    $pdo = get_pdo();

    // Rate limiting anti-enumeración: máx 60 búsquedas/min por IP
    // Usa la misma tabla auth_rate_limit con prefijo 'v:' para no mezclar con login
    try {
        $ip  = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown')[0]);
        $key = 'v:' . $ip;
        $stRl = $pdo->prepare('SELECT intentos, UNIX_TIMESTAMP(ultimo_intento) AS ts FROM auth_rate_limit WHERE ip = ?');
        $stRl->execute([$key]);
        $rl = $stRl->fetch();
        if ($rl) {
            $elapsed = time() - (int)$rl['ts'];
            if ($elapsed > 60) {
                $pdo->prepare('DELETE FROM auth_rate_limit WHERE ip = ?')->execute([$key]);
            } elseif ((int)$rl['intentos'] >= 60) {
                json_error('Demasiadas solicitudes. Intente de nuevo en un momento.', 429);
            }
        }
        $pdo->prepare(
            'INSERT INTO auth_rate_limit (ip, intentos, ultimo_intento) VALUES (?, 1, NOW())
             ON DUPLICATE KEY UPDATE intentos = intentos + 1, ultimo_intento = NOW()'
        )->execute([$key]);
    } catch (PDOException $e) {
        error_log('[otec-demo] rate_limit verificar error (tabla ausente?): ' . $e->getMessage());
        // Si la tabla no existe, continuar sin rate limiting
    }

    $stmt = $pdo->prepare(
        'SELECT c.*,
                cu.codigo_sence   AS cur_codigo_sence,
                cu.contenidos     AS cur_contenidos,
                cu.vigencia_meses AS cur_vigencia_meses
         FROM certificados c
         LEFT JOIN cursos cu ON cu.id = c.curso_id
         WHERE UPPER(c.codigo_certificado) = ?'
    );
    $stmt->execute([$codigo]);
    $row = $stmt->fetch();

    if (!$row) {
        json_response(null);
    }

    json_response([
        'codigoCertificado'  => $row['codigo_certificado']  ?? '',
        'curso'              => $row['curso']               ?? '',
        'empresaNombre'      => $row['empresa_nombre']      ?? '',
        'nombre'             => $row['nombre_participante'] ?? '',
        'nombreParticipante' => $row['nombre_participante'] ?? '',
        'rut'                => $row['rut_participante']    ?? '',
        'rutParticipante'    => $row['rut_participante']    ?? '',
        'fechaEmision'       => $row['fecha_emision']       ?? '',
        'fechaVencimiento'   => $row['fecha_vencimiento']   ?? '',
        'horas'              => (float)($row['horas']         ?? 0),
        'asistencia'         => (float)($row['asistencia']  ?? 0),
        'evaluacion'         => (float)($row['evaluacion']  ?? 0),
        'estado'             => $row['estado']              ?? '',
        'fechaInicioCurso'   => $row['fecha_inicio_curso']  ?? '',
        'fechaTerminoCurso'  => $row['fecha_termino_curso'] ?? '',
        'lugarEjecucion'     => $row['lugar_ejecucion']     ?? '',
        'condicion'          => $row['condicion']           ?? '',
        'codigoSence'        => $row['cur_codigo_sence']    ?? '',
        'contenidos'         => $row['cur_contenidos']      ?? '',
        'vigenciaMeses'      => (int)($row['cur_vigencia_meses'] ?? 0),
    ]);
} catch (PDOException $e) {
    json_error('Error interno del servidor', 500);
}
