<?php
// ════════════════════════════════════════════════════════════════════════════
// reset_demo.php — Restablece los datos de ejemplo de la demo pública
// Pensado para ser llamado una vez al día por un workflow programado (cron):
//   GET /api/reset_demo.php?token=TU_TOKEN
// ════════════════════════════════════════════════════════════════════════════

require_once __DIR__ . '/helpers.php';

// ─── Verificar token de seguridad ─────────────────────────────────────────────
$token = $_GET['token'] ?? '';
$placeholders = ['cambia-esta-reset-key-por-una-propia'];
if (!defined('RESET_TOKEN') || in_array(RESET_TOKEN, $placeholders, true)) {
    json_error('RESET_TOKEN no ha sido configurado. Ver config.php', 500);
}
if (!hash_equals(RESET_TOKEN, $token)) {
    json_error('Forbidden', 403);
}

$pdo = get_pdo();

// Contraseña para las 3 cuentas demo: Demo2026!
$hashDemo = '$2y$10$CfdJo5u9fS9Ndk5hhaeJRu5l0KT9xAZ971IlDg89iRiSrzy8lRICq';

$statements = [
  "SET foreign_key_checks = 0",

  "DELETE FROM `lotes_certificados`",
  "DELETE FROM `certificados`",
  "DELETE FROM `cursos`",
  "DELETE FROM `personas`",
  "DELETE FROM `usuarios`",
  "DELETE FROM `empresas`",

  // ─── EMPRESAS ───────────────────────────────────────────────────────────────
  "INSERT INTO `empresas` (`id`, `nombre`, `rut`, `contacto`, `email`, `telefono`, `region`, `usuarios`, `cursos`, `estado`, `creado_en`) VALUES
   (1, 'Empresa Ejemplo 1', '76.111.111-6', 'Contacto Ejemplo 1', 'empresa1@example.com', '+56 9 1111 1111', 'Metropolitana', 1, 4, 'Activa', NOW() - INTERVAL 6 MONTH),
   (2, 'Empresa Ejemplo 2', '76.111.112-4', 'Contacto Ejemplo 2', 'empresa2@example.com', '+56 9 2222 2222', 'Antofagasta',   0, 4, 'Activa', NOW() - INTERVAL 6 MONTH),
   (3, 'Empresa Ejemplo 3', '76.111.113-2', 'Contacto Ejemplo 3', 'empresa3@example.com', '+56 9 3333 3333', 'Valparaíso',    0, 4, 'Activa', NOW() - INTERVAL 6 MONTH)",

  // ─── USUARIOS ───────────────────────────────────────────────────────────────
  "INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol_id`, `empresa_id`, `empresa_nombre`, `activo`) VALUES
   (1, 'Superadministrador Demo', 'admin@otec-demo.cl',    '$hashDemo', 'superadmin', NULL, NULL,               1),
   (2, 'Operador Demo',           'operador@otec-demo.cl', '$hashDemo', 'operador',   NULL, NULL,               1),
   (3, 'Usuario Empresa Demo',    'empresa@otec-demo.cl',  '$hashDemo', 'empresa',    1,    'Empresa Ejemplo 1', 1)",

  // ─── PERSONAS ───────────────────────────────────────────────────────────────
  "INSERT INTO `personas` (`id`, `nombre`, `rut`, `email`, `empresa`, `empresa_id`) VALUES
   (1,  'Persona Ejemplo 1',  '11.111.111-1', 'persona1@example.com',  'Empresa Ejemplo 1', 1),
   (2,  'Persona Ejemplo 2',  '11.111.112-K', 'persona2@example.com',  'Empresa Ejemplo 1', 1),
   (3,  'Persona Ejemplo 3',  '11.111.113-8', 'persona3@example.com',  'Empresa Ejemplo 1', 1),
   (4,  'Persona Ejemplo 4',  '11.111.114-6', 'persona4@example.com',  'Empresa Ejemplo 1', 1),
   (5,  'Persona Ejemplo 5',  '11.111.115-4', 'persona5@example.com',  'Empresa Ejemplo 2', 2),
   (6,  'Persona Ejemplo 6',  '11.111.116-2', 'persona6@example.com',  'Empresa Ejemplo 2', 2),
   (7,  'Persona Ejemplo 7',  '11.111.117-0', 'persona7@example.com',  'Empresa Ejemplo 2', 2),
   (8,  'Persona Ejemplo 8',  '11.111.118-9', 'persona8@example.com',  'Empresa Ejemplo 2', 2),
   (9,  'Persona Ejemplo 9',  '11.111.119-7', 'persona9@example.com',  'Empresa Ejemplo 3', 3),
   (10, 'Persona Ejemplo 10', '11.111.120-0', 'persona10@example.com', 'Empresa Ejemplo 3', 3),
   (11, 'Persona Ejemplo 11', '11.111.121-9', 'persona11@example.com', 'Empresa Ejemplo 3', 3),
   (12, 'Persona Ejemplo 12', '11.111.122-7', 'persona12@example.com', 'Empresa Ejemplo 3', 3)",

  // ─── CURSOS ─────────────────────────────────────────────────────────────────
  "INSERT INTO `cursos` (`id`, `nombre`, `codigo_sence`, `horas`, `condicion`, `modalidad`, `categorias`, `objetivos`, `contenidos`, `estado`, `plantilla_id`, `vigencia_meses`, `precio`, `total_emisiones`, `porcentaje_asistencia`, `porcentaje_aprobacion`, `creado_en`) VALUES
   (1, 'Curso 1', 'NO-APLICA', 16, 'Aprobación', 'Presencial', '[\"Categoría 1\"]', 'Objetivo de ejemplo para el curso 1.', 'Módulo 1: Contenido de ejemplo\\n- Punto 1\\n- Punto 2\\nMódulo 2: Contenido de ejemplo\\n- Punto 1\\n- Punto 2', 'Activo', NULL, 24, 45000, 6, 75, 60, NOW() - INTERVAL 6 MONTH),
   (2, 'Curso 2', 'NO-APLICA', 8,  'Aprobación', 'Presencial', '[\"Categoría 2\"]', 'Objetivo de ejemplo para el curso 2.', 'Módulo 1: Contenido de ejemplo\\n- Punto 1\\n- Punto 2\\nMódulo 2: Contenido de ejemplo\\n- Punto 1\\n- Punto 2', 'Activo', NULL, 12, 30000, 4, 75, 60, NOW() - INTERVAL 6 MONTH),
   (3, 'Curso 3', 'NO-APLICA', 12, 'Aprobación', 'Presencial', '[\"Categoría 3\"]', 'Objetivo de ejemplo para el curso 3.', 'Módulo 1: Contenido de ejemplo\\n- Punto 1\\n- Punto 2\\nMódulo 2: Contenido de ejemplo\\n- Punto 1\\n- Punto 2', 'Activo', NULL, 12, 35000, 3, 75, 60, NOW() - INTERVAL 6 MONTH),
   (4, 'Curso 4', 'NO-APLICA', 4,  'Aprobación', 'Presencial', '[\"Categoría 1\"]', 'Objetivo de ejemplo para el curso 4.', 'Módulo 1: Contenido de ejemplo\\n- Punto 1\\n- Punto 2\\nMódulo 2: Contenido de ejemplo\\n- Punto 1\\n- Punto 2', 'Activo', NULL, 12, 20000, 3, 75, 60, NOW() - INTERVAL 6 MONTH)",

  // ─── CERTIFICADOS ───────────────────────────────────────────────────────────
  "INSERT INTO `certificados`
    (`id`, `codigo_certificado`, `curso`, `curso_id`, `empresa_id`, `empresa_nombre`, `nombre_participante`, `rut_participante`,
     `fecha_emision`, `fecha_vencimiento`, `horas`, `asistencia`, `evaluacion`, `estado`, `persona_id`,
     `folio`, `cargo_participante`, `fecha_inicio_curso`, `fecha_termino_curso`, `lugar_ejecucion`, `condicion`) VALUES
   (1,  'CERT-EJEMPLO-0001', 'Curso 1', 1, 1, 'Empresa Ejemplo 1', 'Persona Ejemplo 1',  '11.111.111-1', '2026-02-10', '2028-02-10', 16, 100, 85, 'Aprobado', 1,  '2026-0001', 'Participante', '2026-02-09', '2026-02-10', 'Santiago',    'Aprobación'),
   (2,  'CERT-EJEMPLO-0002', 'Curso 1', 1, 1, 'Empresa Ejemplo 1', 'Persona Ejemplo 2',  '11.111.112-K', '2026-02-10', '2028-02-10', 16, 100, 92, 'Aprobado', 2,  '2026-0001', 'Participante', '2026-02-09', '2026-02-10', 'Santiago',    'Aprobación'),
   (3,  'CERT-EJEMPLO-0003', 'Curso 1', 1, 1, 'Empresa Ejemplo 1', 'Persona Ejemplo 3',  '11.111.113-8', '2026-02-10', '2028-02-10', 16, 88,  55, 'Reprobado', 3, '2026-0001', 'Participante', '2026-02-09', '2026-02-10', 'Santiago',    'Aprobación'),
   (4,  'CERT-EJEMPLO-0004', 'Curso 2', 2, 3, 'Empresa Ejemplo 3', 'Persona Ejemplo 9',  '11.111.119-7', '2026-03-05', '2027-03-05', 8,  100, 90, 'Aprobado', 9,  '2026-0002', 'Participante', '2026-03-05', '2026-03-05', 'Valparaíso',  'Aprobación'),
   (5,  'CERT-EJEMPLO-0005', 'Curso 2', 2, 3, 'Empresa Ejemplo 3', 'Persona Ejemplo 10', '11.111.120-0', '2026-03-05', '2027-03-05', 8,  100, 78, 'Aprobado', 10, '2026-0002', 'Participante', '2026-03-05', '2026-03-05', 'Valparaíso',  'Aprobación'),
   (6,  'CERT-EJEMPLO-0006', 'Curso 2', 2, 3, 'Empresa Ejemplo 3', 'Persona Ejemplo 11', '11.111.121-9', '2026-03-05', '2027-03-05', 8,  90,  81, 'Aprobado', 11, '2026-0002', 'Participante', '2026-03-05', '2026-03-05', 'Valparaíso',  'Aprobación'),
   (7,  'CERT-EJEMPLO-0007', 'Curso 2', 2, 3, 'Empresa Ejemplo 3', 'Persona Ejemplo 12', '11.111.122-7', '2026-03-05', '2027-03-05', 8,  100, 88, 'Aprobado', 12, '2026-0002', 'Participante', '2026-03-05', '2026-03-05', 'Valparaíso',  'Aprobación'),
   (8,  'CERT-EJEMPLO-0008', 'Curso 3', 3, 2, 'Empresa Ejemplo 2', 'Persona Ejemplo 5',  '11.111.115-4', '2026-04-14', '2027-04-14', 12, 100, 95, 'Aprobado', 5,  NULL, 'Participante', '2026-04-13', '2026-04-14', 'Antofagasta', 'Aprobación'),
   (9,  'CERT-EJEMPLO-0009', 'Curso 3', 3, 2, 'Empresa Ejemplo 2', 'Persona Ejemplo 6',  '11.111.116-2', '2026-04-14', '2027-04-14', 12, 100, 70, 'Aprobado', 6,  NULL, 'Participante', '2026-04-13', '2026-04-14', 'Antofagasta', 'Aprobación'),
   (10, 'CERT-EJEMPLO-0010', 'Curso 3', 3, 2, 'Empresa Ejemplo 2', 'Persona Ejemplo 7',  '11.111.117-0', '2026-04-14', '2027-04-14', 12, 75,  60, 'Aprobado', 7,  NULL, 'Participante', '2026-04-13', '2026-04-14', 'Antofagasta', 'Aprobación'),
   (11, 'CERT-EJEMPLO-0011', 'Curso 4', 4, 2, 'Empresa Ejemplo 2', 'Persona Ejemplo 8',  '11.111.118-9', '2026-05-20', '2027-05-20', 4,  100, 91, 'Aprobado', 8,  NULL, 'Participante', '2026-05-20', '2026-05-20', 'Antofagasta', 'Aprobación'),
   (12, 'CERT-EJEMPLO-0012', 'Curso 4', 4, 1, 'Empresa Ejemplo 1', 'Persona Ejemplo 4',  '11.111.114-6', '2026-05-20', '2027-05-20', 4,  100, 84, 'Aprobado', 4,  NULL, 'Participante', '2026-05-20', '2026-05-20', 'Santiago',    'Aprobación'),
   (13, 'CERT-EJEMPLO-0013', 'Curso 1', 1, 2, 'Empresa Ejemplo 2', 'Persona Ejemplo 5',  '11.111.115-4', '2026-06-02', '2028-06-02', 16, 95,  77, 'Aprobado', 5,  NULL, 'Participante', '2026-06-01', '2026-06-02', 'Antofagasta', 'Aprobación'),
   (14, 'CERT-EJEMPLO-0014', 'Curso 1', 1, 2, 'Empresa Ejemplo 2', 'Persona Ejemplo 6',  '11.111.116-2', '2026-06-02', '2028-06-02', 16, 92,  68, 'Aprobado', 6,  NULL, 'Participante', '2026-06-01', '2026-06-02', 'Antofagasta', 'Aprobación'),
   (15, 'CERT-EJEMPLO-0015', 'Curso 2', 2, 1, 'Empresa Ejemplo 1', 'Persona Ejemplo 1',  '11.111.111-1', '2026-06-25', '2027-06-25', 8,  100, 89, 'Aprobado', 1,  NULL, 'Participante', '2026-06-25', '2026-06-25', 'Santiago',    'Aprobación'),
   (16, 'CERT-EJEMPLO-0016', 'Curso 3', 3, 3, 'Empresa Ejemplo 3', 'Persona Ejemplo 12', '11.111.122-7', '2026-07-08', '2027-07-08', 12, 100, 93, 'Aprobado', 12, NULL, 'Participante', '2026-07-07', '2026-07-08', 'Valparaíso',  'Aprobación')",

  // ─── LOTES DE CERTIFICADOS ──────────────────────────────────────────────────
  "INSERT INTO `lotes_certificados` (`id`, `folio`, `curso_id`, `plantilla_id`, `tipo_certificado`, `cantidad_emitida`, `participantes_ids`, `participantes_data`, `emitido_por_id`, `emitido_en`) VALUES
   (1, '2026-0001', 1, NULL, 'Aprobación', 3,
    '[1,2,3]',
    '[{\"nombre\":\"Persona Ejemplo 1\",\"rut\":\"11.111.111-1\",\"email\":\"persona1@example.com\",\"asistencia\":100,\"evaluacion\":85,\"estado\":\"Aprobado\"},{\"nombre\":\"Persona Ejemplo 2\",\"rut\":\"11.111.112-K\",\"email\":\"persona2@example.com\",\"asistencia\":100,\"evaluacion\":92,\"estado\":\"Aprobado\"},{\"nombre\":\"Persona Ejemplo 3\",\"rut\":\"11.111.113-8\",\"email\":\"persona3@example.com\",\"asistencia\":88,\"evaluacion\":55,\"estado\":\"Reprobado\"}]',
    2, NOW() - INTERVAL 5 MONTH),
   (2, '2026-0002', 2, NULL, 'Aprobación', 4,
    '[9,10,11,12]',
    '[{\"nombre\":\"Persona Ejemplo 9\",\"rut\":\"11.111.119-7\",\"email\":\"persona9@example.com\",\"asistencia\":100,\"evaluacion\":90,\"estado\":\"Aprobado\"},{\"nombre\":\"Persona Ejemplo 10\",\"rut\":\"11.111.120-0\",\"email\":\"persona10@example.com\",\"asistencia\":100,\"evaluacion\":78,\"estado\":\"Aprobado\"},{\"nombre\":\"Persona Ejemplo 11\",\"rut\":\"11.111.121-9\",\"email\":\"persona11@example.com\",\"asistencia\":90,\"evaluacion\":81,\"estado\":\"Aprobado\"},{\"nombre\":\"Persona Ejemplo 12\",\"rut\":\"11.111.122-7\",\"email\":\"persona12@example.com\",\"asistencia\":100,\"evaluacion\":88,\"estado\":\"Aprobado\"}]',
    2, NOW() - INTERVAL 4 MONTH)",

  "SET foreign_key_checks = 1",
];

try {
    foreach ($statements as $sql) {
        $pdo->exec($sql);
    }
} catch (PDOException $e) {
    json_error('Error al restablecer los datos: ' . $e->getMessage(), 500);
}

json_response(['ok' => true, 'mensaje' => 'Datos de demo restablecidos', 'fecha' => date('Y-m-d H:i:s')]);
