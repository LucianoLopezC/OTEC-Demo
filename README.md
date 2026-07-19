# OTEC Demo – Plataforma de Gestión de Capacitación

Demo de portafolio de un sistema de gestión para un **OTEC** (Organismo Técnico de Capacitación), pensado para mostrar un panel administrativo completo de una plataforma de capacitación profesional.

> ⚠️ Este repositorio es una **demo con fines de portafolio**. Los datos, credenciales y configuración son ficticios (a pedido de el cliente real).

## ¿Qué hace el proyecto?

Es un panel de administración donde una empresa de capacitación puede gestionar todo el ciclo de sus cursos y certificaciones:

- **Dashboard** con vista general del sistema
- **Gestión de empresas** clientes y sus datos
- **Gestión de personas/participantes** y su historial
- **Gestión de cursos** (catálogo de capacitaciones)
- **Emisión de certificados** (individual y masiva), con plantillas Word personalizables
- **Verificación pública de certificados** por código/folio
- **Cotizador** de cursos con generación de PDF
- **Reportes BI** con gráficos y KPIs de certificados, cursos, empresas y personas
- **Gestión de usuarios y roles** con permisos por sección
- **Autenticación** y control de acceso

## Tecnologías

**Frontend:** React, Vite, React Router, Tailwind CSS, Recharts, TipTap

**Documentos y exportación:** jsPDF, docxtemplater, docx-preview, ExcelJS / xlsx, JSZip, file-saver, QRCode

**Backend:** PHP (API REST), MySQL

**Otros:** ESLint, Supabase (integración auxiliar)
