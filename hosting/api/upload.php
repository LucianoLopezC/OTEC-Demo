<?php
// ════════════════════════════════════════════════════════════════════════════
// upload.php — Subida y eliminación de archivos
// POST   /api/upload.php        → sube un archivo (multipart/form-data)
// DELETE /api/upload.php?path=X&bucket=Y → elimina un archivo
// ════════════════════════════════════════════════════════════════════════════

require_once __DIR__ . '/helpers.php';
cors_headers();
$user = auth_required();

$method = $_SERVER['REQUEST_METHOD'];

// Buckets permitidos → carpeta relativa dentro de UPLOAD_DIR
$buckets = [
    'plantillas-docx'     => 'plantillas-docx/',
    'certificados-lotes'  => 'certificados-lotes/',
    'plantillas'          => 'imagenes/',   // imágenes legacy
];

// ─── DELETE: eliminar archivo ─────────────────────────────────────────────────
if ($method === 'DELETE') {
    $path   = $_GET['path']   ?? '';
    $bucket = $_GET['bucket'] ?? '';

    if (!$path || !isset($buckets[$bucket])) json_error('Parámetros inválidos');

    $cleanPath = ltrim(basename($path), '/\\');
    $fullPath  = UPLOAD_DIR . $buckets[$bucket] . $cleanPath;
    $realBase  = realpath(UPLOAD_DIR . $buckets[$bucket]);
    $realFile  = realpath($fullPath);

    if ($realBase && $realFile && str_starts_with($realFile, $realBase . DIRECTORY_SEPARATOR)) {
        unlink($realFile);
    }
    json_response(['ok' => true]);
}

// ─── POST: subir archivo ──────────────────────────────────────────────────────
if ($method === 'POST') {
    $bucket = $_POST['bucket'] ?? '';
    if (!isset($buckets[$bucket])) json_error('Bucket no válido');

    if (empty($_FILES['file'])) json_error('No se recibió ningún archivo');

    $file    = $_FILES['file'];
    $error   = $file['error']    ?? UPLOAD_ERR_NO_FILE;
    $tmpName = $file['tmp_name'] ?? '';
    $origName= $file['name']     ?? 'file';

    if ($error !== UPLOAD_ERR_OK) json_error('Error al recibir el archivo (código ' . $error . ')');

    // Validar extensión según bucket
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    $allowedExt = match($bucket) {
        'plantillas-docx'    => ['docx', 'xlsx'],
        'certificados-lotes' => ['zip'],
        'plantillas'         => ['png','jpg','jpeg','gif','webp'],
        default              => [],
    };
    if (!in_array($ext, $allowedExt, true)) {
        json_error('Tipo de archivo no permitido. Permitidos: ' . implode(', ', $allowedExt));
    }

    $finfo    = finfo_open(FILEINFO_MIME_TYPE);
    $realMime = finfo_file($finfo, $tmpName);
    finfo_close($finfo);
    $allowedMimes = match($bucket) {
        // .docx y .xlsx son ZIPs internamente — múltiples MIMEs válidos
        'plantillas-docx'    => [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/zip',
            'application/octet-stream',
        ],
        // Los .zip con .docx adentro pueden ser detectados como docx por libmagic
        'certificados-lotes' => [
            'application/zip',
            'application/octet-stream',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        'plantillas'         => ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        default              => [],
    };
    if (!in_array($realMime, $allowedMimes, true)) {
        error_log('[otec-demo] upload.php: MIME rechazado bucket=' . $bucket . ' mime=' . $realMime . ' file=' . $origName);
        json_error('El contenido del archivo no coincide con el tipo permitido. MIME detectado: ' . $realMime);
    }

    // Crear directorio destino si no existe
    $destDir = UPLOAD_DIR . $buckets[$bucket];
    if (!is_dir($destDir)) {
        if (!mkdir($destDir, 0755, true)) {
            error_log('[otec-demo] upload.php: no se pudo crear directorio: ' . $destDir);
            json_error('No se pudo crear el directorio de destino', 500);
        }
    }
    if (!is_writable($destDir)) {
        error_log('[otec-demo] upload.php: directorio sin permiso de escritura: ' . $destDir);
        json_error('El directorio de destino no tiene permisos de escritura', 500);
    }

    // Nombre único para evitar colisiones
    $newName = time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    $destPath = $destDir . $newName;

    if (!move_uploaded_file($tmpName, $destPath)) {
        error_log('[otec-demo] upload.php: move_uploaded_file falló. tmp=' . $tmpName . ' dest=' . $destPath . ' writable=' . (is_writable($destDir) ? 'si' : 'no') . ' upload_dir=' . UPLOAD_DIR);
        json_error('Error al guardar el archivo en el servidor', 500);
    }

    json_response([
        'path'      => $newName,
        'fullPath'  => $buckets[$bucket] . $newName,
        'publicUrl' => APP_URL . '/uploads/' . $buckets[$bucket] . $newName,
    ], 201);
}

json_error('Método no permitido', 405);
