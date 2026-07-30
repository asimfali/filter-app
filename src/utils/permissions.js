export const can = (user, code) => {
    if (!user) return false;
    return user.permissions?.includes(code) ?? false;
};

export const canAny = (user, codes) => {
    if (!user) return false;
    return codes.some(code => can(user, code));
};

// ── Коды прав ──────────────────────────────────────────────────────────────
// Зеркало бэкенд-констант (RBACService) — источник истины там, здесь только
// чтобы не хардкодить строки по всему фронту и не плодить опечатки.
// Права, приходящие с бэка динамически (dt.upload_permission_code и т.п.) —
// не сюда, они и так не строковые литералы в коде.

export const PERM = {
    // catalog
    CATALOG_ACCESSORY_WRITE: 'catalog.accessory.write',
    CATALOG_BINDING_WRITE: 'catalog.binding.write',
    CATALOG_PUSH_TO_1C: 'catalog.push_to_1c',
    CATALOG_SERIES_MANAGE: 'catalog.series.manage',
    CATALOG_SPEC_WRITE: 'catalog.spec.write',

    // bom
    BOM_DEFECT_VIEW: 'bom.defect.view',
    BOM_DEFECT_WRITE: 'bom.defect.write',
    BOM_SPEC_PUSH: 'bom.spec.push',
    BOM_SPEC_VIEW: 'bom.spec.view',
    BOM_SPEC_WRITE: 'bom.spec.write',

    // plm
    PLM_STAGE_MANAGE: 'plm.stage.manage',
    PLM_STAGE_VIEW: 'plm.stage.view',

    // sales
    SALES_CART_WRITE: 'sales.cart.write',

    // external
    EXTERNAL_MANAGE_VARIANTS: 'external.manage_variants',
    EXTERNAL_PUSH_TO_SITE: 'external.push_to_site',
    EXTERNAL_RSYNC_MEDIA: 'external.rsync_media',
    EXTERNAL_SYNC_CATALOG: 'external.sync_catalog',
    EXTERNAL_SYNC_PRICES: 'external.sync_prices',

    // portal
    PORTAL_CHART_WRITE: 'portal.chart.write',
    PORTAL_DOCUMENTS_DELETE: 'portal.documents.delete',
    PORTAL_DOCUMENTS_UPLOAD: 'portal.documents.upload',
    PORTAL_GALLERY_UPLOAD: 'portal.gallery.upload',
    PORTAL_HEAT_EXCHANGER_VIEW: 'portal.heat_exchanger.view',
    PORTAL_HEAT_EXCHANGER_WRITE: 'portal.heat_exchanger.write',
    PORTAL_PAGE_BINDING: 'portal.page.binding',
    PORTAL_PAGE_DOCUMENTS: 'portal.page.documents',
    PORTAL_PAGE_ISSUES: 'portal.page.issues',
    PORTAL_PAGE_PARAMETERS: 'portal.page.parameters',
    PORTAL_PAGE_SELECTION: 'portal.page.selection',
    PORTAL_PAGE_STAFF: 'portal.page.staff',
    PORTAL_S3_UPLOAD: 'portal.s3.upload',
    PORTAL_STAFF_DEPARTMENTS: 'portal.staff.departments',
    PORTAL_STAFF_REQUESTS: 'portal.staff.requests',
    PORTAL_STAFF_USERS: 'portal.staff.users',
    PORTAL_VIDEO_UPLOAD: 'portal.video.upload',

    // passport
    PASSPORT_DOCUMENTS_UPDATE: 'passport.documents.update',
    PASSPORT_DOCUMENTS_UPLOAD: 'passport.documents.upload',

    // pdf
    PDF_SPEC_WRITE: 'pdf.spec.write',

    // не подпадают под доменный неймспейс (так уже на бэкенде)
    PAGE_GRAPH_READ: 'page.graph.read',
    PRODUCT_VARIANT_VIEW: 'product.variant.view',
};