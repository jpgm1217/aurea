'use strict';

(function exposeAureaDomain(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AureaDomain = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  const n = value => Number(value) || 0;
  const positiveInteger = value => Number.isInteger(Number(value)) && Number(value) > 0;
  const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0;
  const finiteNonNegative = value => Number.isFinite(Number(value)) && Number(value) >= 0;
  const clampStock = value => Math.max(0, n(value));

  function normalizeUnit(value) {
    const clean = String(value || '').trim().toLowerCase();
    const allowed = new Set(['unidad', 'centímetro', 'metro', 'gramo']);
    return allowed.has(clean) ? clean : 'unidad';
  }

  function unitLabel(unit, quantity = 2) {
    const normalized = normalizeUnit(unit);
    const singular = Math.abs(n(quantity)) === 1;
    if (normalized === 'centímetro') return singular ? 'centímetro' : 'centímetros';
    if (normalized === 'metro') return singular ? 'metro' : 'metros';
    if (normalized === 'gramo') return singular ? 'gramo' : 'gramos';
    return singular ? 'unidad' : 'unidades';
  }

  function formatQuantity(quantity, unit) {
    const value = n(quantity);
    const formatted = new Intl.NumberFormat('es-CO', {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2
    }).format(value);
    return `${formatted} ${unitLabel(unit, value)}`;
  }

  function getMaterial(state, id) {
    return (state.materials || []).find(item => item.id === id);
  }

  function getDesign(state, id) {
    return (state.designs || []).find(item => item.id === id);
  }

  function getProduction(state, id) {
    return (state.productions || []).find(item => item.id === id);
  }

  function activeLots(state, designId) {
    return (state.productions || [])
      .filter(item => item.designId === designId && item.status !== 'Anulada' && n(item.availableQuantity) > 0)
      .sort((a, b) => n(a.createdAt) - n(b.createdAt));
  }

  function recalculateDesignInventory(state, designId) {
    const design = getDesign(state, designId);
    if (!design) return;
    const lots = activeLots(state, designId);
    const stock = lots.reduce((sum, lot) => sum + n(lot.availableQuantity), 0);
    const value = lots.reduce((sum, lot) => sum + n(lot.availableQuantity) * n(lot.unitCost), 0);
    design.finishedStock = stock;
    design.finishedUnitCost = stock > 0 ? value / stock : 0;
  }

  function costBreakdown(state, design) {
    const materials = (design?.components || []).reduce((sum, component) => {
      const material = getMaterial(state, component.materialId);
      return sum + n(material?.cost) * n(component.qty);
    }, 0);
    const waste = materials * n(state.settings?.wastePct) / 100;
    const labor = n(state.settings?.labor);
    const packaging = n(state.settings?.packaging);
    return {
      materials,
      waste,
      labor,
      packaging,
      total: materials + waste + labor + packaging
    };
  }

  function aggregateComponents(components) {
    const grouped = new Map();
    (components || []).forEach(component => {
      const materialId = component?.materialId;
      if (!materialId) return;
      const current = grouped.get(materialId) || { ...component, materialId, qty: 0 };
      current.qty += n(component.qty);
      if (!current.name && component.name) current.name = component.name;
      grouped.set(materialId, current);
    });
    return [...grouped.values()];
  }

  function productionAvailability(state, design) {
    const components = aggregateComponents(design?.components);
    if (!components.length) return 0;
    return components.reduce((available, component) => {
      const required = n(component.qty);
      const material = getMaterial(state, component.materialId);
      if (!material || required <= 0) return 0;
      return Math.min(available, Math.floor((n(material.stock) + 1e-9) / required));
    }, Number.MAX_SAFE_INTEGER);
  }

  function paymentSummary(sale) {
    const total = n(sale?.total ?? sale?.price);
    const payments = (sale?.payments || [])
      .filter(item => item.status !== 'Anulado')
      .reduce((sum, item) => sum + n(item.amount), 0);
    const refunds = (sale?.refunds || [])
      .filter(item => item.status !== 'Anulado')
      .reduce((sum, item) => sum + n(item.amount), 0);
    const paid = Math.max(0, payments - refunds);
    const balance = Math.max(0, total - paid);
    const status = balance <= 0.005 ? 'Pagado' : paid > 0 ? 'Abono' : 'Pendiente';
    return { total, payments, refunds, paid, balance, status };
  }

  function addMovement(state, movement) {
    state.movements = Array.isArray(state.movements) ? state.movements : [];
    if (state.movements.some(item => item.id === movement.id)) return;
    state.movements.push(movement);
  }

  function applyProduction(state, input) {
    state.productions = Array.isArray(state.productions) ? state.productions : [];
    const existing = getProduction(state, input.productionId);
    if (existing) return { ok: true, production: existing, duplicate: true };

    const design = getDesign(state, input.designId);
    const quantity = Number(input.quantity);
    if (!design) return { ok: false, error: 'El diseño ya no existe.' };
    if (design.active === false && input.source !== 'Inventario inicial') {
      return { ok: false, error: 'El diseño está inactivo y no se puede fabricar.' };
    }
    if (!positiveInteger(quantity)) return { ok: false, error: 'La cantidad a fabricar debe ser un número entero mayor que cero.' };

    const isInitial = input.source === 'Inventario inicial';
    if (!isInitial && !(design.components || []).length) {
      return { ok: false, error: 'El diseño necesita una receta de materiales antes de fabricar.' };
    }

    const costs = isInitial
      ? { materials: 0, waste: 0, labor: 0, packaging: 0, total: n(input.unitCost) }
      : costBreakdown(state, design);
    if (costs.total < 0 || (isInitial && n(input.unitCost) <= 0)) {
      return { ok: false, error: 'Ingresa un costo unitario válido.' };
    }

    const componentsSnapshot = (isInitial ? [] : aggregateComponents(design.components)).map((component, index) => {
      const material = getMaterial(state, component.materialId);
      const qtyPerUnit = n(component.qty);
      return {
        materialId: component.materialId,
        name: component.name || material?.name || 'Material',
        unit: normalizeUnit(material?.unit),
        qtyPerUnit,
        totalQty: qtyPerUnit * quantity,
        unitCost: n(material?.cost),
        totalCost: qtyPerUnit * quantity * n(material?.cost),
        movementId: `${input.productionId}_material_${index + 1}`
      };
    });

    const shortages = componentsSnapshot.filter(component => {
      const material = getMaterial(state, component.materialId);
      return !material || n(material.stock) + 1e-9 < n(component.totalQty);
    });
    if (shortages.length) {
      const detail = shortages.map(component => {
        const material = getMaterial(state, component.materialId);
        const missing = Math.max(0, n(component.totalQty) - n(material?.stock));
        return `${component.name} (faltan ${formatQuantity(missing, component.unit)})`;
      }).join(', ');
      return { ok: false, error: `Stock insuficiente: ${detail}` };
    }

    const timestamp = n(input.createdAt) || Date.now();
    componentsSnapshot.forEach(component => {
      const material = getMaterial(state, component.materialId);
      material.stock = clampStock(n(material.stock) - n(component.totalQty));
      material.updatedAt = timestamp;
      addMovement(state, {
        id: component.movementId,
        materialId: material.id,
        materialName: material.name,
        unit: normalizeUnit(material.unit),
        type: 'Consumo de producción',
        qty: -n(component.totalQty),
        referenceType: 'production',
        referenceId: input.productionId,
        date: input.date,
        createdAt: timestamp
      });
    });

    const unitCost = n(costs.total);
    const production = {
      id: input.productionId,
      operationId: input.operationId,
      lotNumber: input.lotNumber,
      designId: design.id,
      designSku: design.sku,
      designName: design.name,
      quantityProduced: quantity,
      availableQuantity: quantity,
      unitCost,
      totalCost: unitCost * quantity,
      costsSnapshot: { ...costs },
      componentsSnapshot,
      source: input.source || 'Fabricación',
      linkedSaleId: input.linkedSaleId || '',
      status: 'Completada',
      date: input.date,
      notes: input.notes || '',
      createdAt: timestamp
    };
    state.productions.push(production);
    addMovement(state, {
      id: `${input.productionId}_finished`,
      designId: design.id,
      designSku: design.sku,
      productName: design.name,
      unit: 'unidad',
      type: production.source,
      qty: quantity,
      referenceType: 'production',
      referenceId: production.id,
      date: production.date,
      createdAt: timestamp
    });
    recalculateDesignInventory(state, design.id);
    return { ok: true, production };
  }

  function applyAnnulProduction(state, input) {
    const production = getProduction(state, input.productionId);
    if (!production || production.status === 'Anulada') {
      return { ok: false, error: 'La producción ya fue anulada o no existe.' };
    }
    if (n(production.availableQuantity) + 1e-9 < n(production.quantityProduced)) {
      return { ok: false, error: 'No se puede anular: alguna unidad de este lote fue vendida.' };
    }
    if (production.source !== 'Inventario inicial' && !(production.componentsSnapshot || []).length) {
      return { ok: false, error: 'No se puede anular: el lote no conserva su receta histórica.' };
    }
    const productionComponents = production.componentsSnapshot || [];
    if (productionComponents.some(component => !component.materialId
      || !finitePositive(component.totalQty)
      || !finiteNonNegative(component.unitCost))
      || new Set(productionComponents.map(component => component.materialId)).size !== productionComponents.length) {
      return { ok: false, error: 'No se puede anular: la receta histórica contiene cantidades o costos inválidos.' };
    }
    const missingMaterial = (production.componentsSnapshot || [])
      .find(component => !getMaterial(state, component.materialId));
    if (missingMaterial) {
      return {
        ok: false,
        error: `No se puede anular: falta el material histórico ${missingMaterial.name || missingMaterial.materialId}.`
      };
    }

    const timestamp = n(input.createdAt) || Date.now();
    (production.componentsSnapshot || []).forEach((component, index) => {
      const material = getMaterial(state, component.materialId);
      const oldStock = n(material.stock);
      const returnedQty = n(component.totalQty);
      const oldValue = oldStock * n(material.cost);
      const returnedValue = returnedQty * n(component.unitCost);
      material.stock = oldStock + returnedQty;
      material.cost = material.stock > 0 ? (oldValue + returnedValue) / material.stock : n(material.cost);
      material.updatedAt = timestamp;
      addMovement(state, {
        id: `${input.operationId}_material_${index + 1}`,
        materialId: material.id,
        materialName: material.name,
        unit: normalizeUnit(material.unit),
        type: 'Anulación de producción',
        qty: returnedQty,
        referenceType: 'production',
        referenceId: production.id,
        date: input.date,
        createdAt: timestamp
      });
    });

    production.availableQuantity = 0;
    production.status = 'Anulada';
    production.annulledAt = timestamp;
    production.annulOperationId = input.operationId;
    addMovement(state, {
      id: `${input.operationId}_finished`,
      designId: production.designId,
      designSku: production.designSku,
      productName: production.designName,
      unit: 'unidad',
      type: 'Anulación de producción',
      qty: -n(production.quantityProduced),
      referenceType: 'production',
      referenceId: production.id,
      date: input.date,
      createdAt: timestamp
    });
    recalculateDesignInventory(state, production.designId);
    return { ok: true, production };
  }

  function allocateLots(state, designId, quantity) {
    let remaining = n(quantity);
    const allocations = [];
    activeLots(state, designId).forEach(lot => {
      if (remaining <= 0) return;
      const allocated = Math.min(remaining, n(lot.availableQuantity));
      if (allocated <= 0) return;
      lot.availableQuantity = clampStock(n(lot.availableQuantity) - allocated);
      allocations.push({
        productionId: lot.id,
        lotNumber: lot.lotNumber,
        qty: allocated,
        unitCost: n(lot.unitCost),
        totalCost: allocated * n(lot.unitCost)
      });
      remaining -= allocated;
    });
    return { allocations, remaining };
  }

  function applySale(state, input) {
    state.sales = Array.isArray(state.sales) ? state.sales : [];
    const duplicate = state.sales.find(item => item.id === input.saleId);
    if (duplicate) return { ok: true, sale: duplicate, duplicate: true };

    const design = getDesign(state, input.designId);
    const quantity = Number(input.quantity);
    const unitPrice = n(input.unitPrice);
    const initialPayment = n(input.initialPayment);
    if (!design) return { ok: false, error: 'El diseño ya no existe.' };
    if (!positiveInteger(quantity)) return { ok: false, error: 'La cantidad vendida debe ser un número entero mayor que cero.' };
    if (unitPrice <= 0) return { ok: false, error: 'Ingresa un precio unitario válido.' };
    const total = unitPrice * quantity;
    if (initialPayment < 0 || initialPayment > total + 0.005) {
      return { ok: false, error: 'El pago inicial no puede ser negativo ni superar el total.' };
    }

    const timestamp = n(input.createdAt) || Date.now();
    let production = null;
    let allocations = [];
    if (input.mode === 'make-to-order') {
      const productionResult = applyProduction(state, {
        productionId: input.productionId,
        operationId: input.operationId,
        lotNumber: input.lotNumber,
        designId: design.id,
        quantity,
        source: 'Fabricación bajo pedido',
        linkedSaleId: input.saleId,
        date: input.date,
        notes: input.notes,
        createdAt: timestamp
      });
      if (!productionResult.ok) return productionResult;
      production = productionResult.production;
      production.availableQuantity = 0;
      allocations = [{
        productionId: production.id,
        lotNumber: production.lotNumber,
        qty: quantity,
        unitCost: n(production.unitCost),
        totalCost: n(production.totalCost)
      }];
    } else {
      const stock = n(design.finishedStock);
      if (stock + 1e-9 < quantity) {
        return { ok: false, error: `Stock terminado insuficiente. Disponibles: ${stock}.` };
      }
      const allocation = allocateLots(state, design.id, quantity);
      if (allocation.remaining > 0) {
        return { ok: false, error: 'Los lotes no coinciden con el stock terminado. Revisa el inventario antes de vender.' };
      }
      allocations = allocation.allocations;
    }

    const totalCost = allocations.reduce((sum, item) => sum + n(item.totalCost), 0);
    const payments = initialPayment > 0 ? [{
      id: input.paymentId,
      amount: initialPayment,
      date: input.date,
      method: input.paymentMethod || 'Otro',
      reference: '',
      notes: 'Pago inicial',
      status: 'Aplicado',
      source: 'sale',
      createdAt: timestamp
    }] : [];
    const sale = {
      id: input.saleId,
      operationId: input.operationId,
      designId: design.id,
      designSku: design.sku,
      designName: design.name,
      customerId: input.customerId || '',
      customer: input.customer || '',
      phone: input.phone || '',
      quantity,
      unitPrice,
      total,
      price: total,
      unitCost: quantity ? totalCost / quantity : 0,
      totalCost,
      cost: totalCost,
      profit: total - totalCost,
      inventoryMode: input.mode === 'make-to-order' ? 'make-to-order' : 'finished-product',
      productionId: production?.id || '',
      lotAllocations: allocations,
      payments,
      refunds: [],
      paymentStatus: initialPayment >= total ? 'Pagado' : initialPayment > 0 ? 'Abono' : 'Pendiente',
      paymentMigrationPending: false,
      status: 'Registrada',
      date: input.date,
      notes: input.notes || '',
      createdAt: timestamp
    };
    state.sales.push(sale);
    addMovement(state, {
      id: `${input.saleId}_finished`,
      designId: design.id,
      designSku: design.sku,
      productName: design.name,
      unit: 'unidad',
      type: 'Venta de producto terminado',
      qty: -quantity,
      referenceType: 'sale',
      referenceId: sale.id,
      date: sale.date,
      createdAt: timestamp
    });
    recalculateDesignInventory(state, design.id);
    return { ok: true, sale, production };
  }

  function applyPayment(state, input) {
    const sale = (state.sales || []).find(item => item.id === input.saleId);
    if (!sale || sale.status === 'Cancelada') return { ok: false, error: 'La venta no admite nuevos pagos.' };
    sale.payments = Array.isArray(sale.payments) ? sale.payments : [];
    if (sale.payments.some(item => item.id === input.paymentId)) return { ok: true, sale, duplicate: true };
    const summary = paymentSummary(sale);
    const amount = n(input.amount);
    if (amount <= 0 || amount > summary.balance + 0.005) {
      return { ok: false, error: `El abono debe estar entre $1 y el saldo pendiente.` };
    }
    sale.payments.push({
      id: input.paymentId,
      amount,
      date: input.date,
      method: input.method || 'Otro',
      reference: input.reference || '',
      notes: input.notes || '',
      status: 'Aplicado',
      source: 'payment',
      createdAt: n(input.createdAt) || Date.now()
    });
    const updated = paymentSummary(sale);
    sale.paymentStatus = updated.status;
    sale.paymentMigrationPending = false;
    sale.updatedAt = n(input.createdAt) || Date.now();
    return { ok: true, sale };
  }

  function applyAnnulPayment(state, input) {
    const sale = (state.sales || []).find(item => item.id === input.saleId);
    if (!sale || sale.status === 'Cancelada') return { ok: false, error: 'La venta no admite cambios de pagos.' };
    const payment = (sale.payments || []).find(item => item.id === input.paymentId);
    if (!payment || payment.status === 'Anulado') return { ok: false, error: 'El abono ya fue anulado o no existe.' };
    const timestamp = n(input.createdAt) || Date.now();
    payment.status = 'Anulado';
    payment.annulledAt = timestamp;
    payment.annulOperationId = input.operationId;
    payment.annulReason = input.reason || 'Corrección de registro';
    sale.paymentStatus = paymentSummary(sale).status;
    sale.updatedAt = timestamp;
    return { ok: true, sale, payment };
  }

  function applyCancelSale(state, input) {
    const sale = (state.sales || []).find(item => item.id === input.saleId);
    if (!sale || sale.status === 'Cancelada') return { ok: false, error: 'La venta ya fue cancelada o no existe.' };
    const timestamp = n(input.createdAt) || Date.now();

    if (['finished-product', 'make-to-order'].includes(sale.inventoryMode)) {
      const allocations = sale.lotAllocations || [];
      if (!allocations.length) {
        return { ok: false, error: 'No se puede anular: la venta no conserva sus lotes de origen.' };
      }
      const allocatedTotal = allocations.reduce((sum, allocation) => sum + n(allocation.qty), 0);
      if (Math.abs(allocatedTotal - n(sale.quantity)) > 1e-9 || allocations.some(item => n(item.qty) <= 0)) {
        return { ok: false, error: 'No se puede anular: las cantidades históricas de los lotes no coinciden.' };
      }
      const quantityByLot = new Map();
      allocations.forEach(allocation => {
        quantityByLot.set(allocation.productionId, n(quantityByLot.get(allocation.productionId)) + n(allocation.qty));
      });
      for (const [productionId, returnedQuantity] of quantityByLot.entries()) {
        const production = getProduction(state, productionId);
        if (!production || production.status === 'Anulada' || production.designId !== sale.designId) {
          return { ok: false, error: 'No fue posible encontrar el lote original de la venta.' };
        }
        if (n(production.availableQuantity) + returnedQuantity > n(production.quantityProduced) + 1e-9) {
          return { ok: false, error: 'No se puede anular: el lote ya tiene todas sus unidades disponibles.' };
        }
      }
      quantityByLot.forEach((returnedQuantity, productionId) => {
        const production = getProduction(state, productionId);
        production.availableQuantity = n(production.availableQuantity) + returnedQuantity;
      });
      addMovement(state, {
        id: `${input.operationId}_finished`,
        designId: sale.designId,
        designSku: sale.designSku,
        productName: sale.designName,
        unit: 'unidad',
        type: 'Anulación de venta',
        qty: n(sale.quantity),
        referenceType: 'sale',
        referenceId: sale.id,
        date: input.date,
        createdAt: timestamp
      });
      recalculateDesignInventory(state, sale.designId);
    } else if (sale.inventoryMode === 'legacy-materials' || sale.deductedInventory) {
      if (!(sale.componentsSnapshot || []).length) {
        return { ok: false, error: 'No se puede anular: la venta histórica no conserva su receta de materiales.' };
      }
      const legacyComponents = sale.componentsSnapshot || [];
      if (legacyComponents.some(component => !component.materialId || !finitePositive(component.qty))
        || new Set(legacyComponents.map(component => component.materialId)).size !== legacyComponents.length) {
        return { ok: false, error: 'No se puede anular: la receta histórica contiene cantidades inválidas.' };
      }
      const missingMaterial = (sale.componentsSnapshot || [])
        .find(component => !getMaterial(state, component.materialId));
      if (missingMaterial) {
        return {
          ok: false,
          error: `No se puede anular: falta el material histórico ${missingMaterial.name || missingMaterial.materialId}.`
        };
      }
      (sale.componentsSnapshot || []).forEach((component, index) => {
        const material = getMaterial(state, component.materialId);
        material.stock = n(material.stock) + n(component.qty);
        material.updatedAt = timestamp;
        addMovement(state, {
          id: `${input.operationId}_legacy_${index + 1}`,
          materialId: material.id,
          materialName: material.name,
          unit: normalizeUnit(material.unit),
          type: 'Anulación venta histórica',
          qty: n(component.qty),
          referenceType: 'sale',
          referenceId: sale.id,
          date: input.date,
          createdAt: timestamp
        });
      });
    }

    const summary = paymentSummary(sale);
    sale.refunds = Array.isArray(sale.refunds) ? sale.refunds : [];
    if (summary.paid > 0) {
      sale.refunds.push({
        id: input.refundId,
        amount: summary.paid,
        date: input.date,
        method: input.refundMethod || 'Mismo medio',
        notes: input.refundNotes || 'Reembolso por cancelación',
        status: 'Aplicado',
        createdAt: timestamp
      });
    }
    sale.paymentStatus = paymentSummary(sale).status;
    sale.status = 'Cancelada';
    sale.cancelledAt = timestamp;
    sale.cancelOperationId = input.operationId;
    return { ok: true, sale };
  }

  return {
    normalizeUnit,
    unitLabel,
    formatQuantity,
    getMaterial,
    getDesign,
    getProduction,
    activeLots,
    recalculateDesignInventory,
    costBreakdown,
    aggregateComponents,
    productionAvailability,
    paymentSummary,
    applyProduction,
    applyAnnulProduction,
    applySale,
    applyPayment,
    applyAnnulPayment,
    applyCancelSale
  };
}));
