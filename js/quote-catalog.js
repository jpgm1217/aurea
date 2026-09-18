'use strict';

(function exposeAureaQuoteSeed(root) {
  const rules = {
    labor: 15000,
    packaging: 10000,
    freeShippingFrom: 250000,
    commission: {
      tier1Rate: 0.35,
      tier2Rate: 0.25,
      tier3Rate: 0.15,
      tier1Limit: 20000,
      tier2Limit: 100000,
      minimumTarget: 3000,
      minimumCapPct: 0.4
    }
  };

  const variants = [
    ['Liso | #3', 'Liso', 3, 9000, 18000, 1600, 14300],
    ['Liso | #4', 'Liso', 4, 10000, 31000, 2200, 25800],
    ['Liso | #5', 'Liso', 5, 13000, 42000, 3900, 37000],
    ['Liso | #6', 'Liso', 6, 16000, 65000, 5000, 57000],
    ['Liso | #7', 'Liso', 7, 0, 90000, 0, 79000],
    ['Liso | #8', 'Liso', 8, 20000, 130000, 9000, 119000],
    ['Diamantado | #3', 'Diamantado', 3, 10000, 18000, 2000, 14300],
    ['Diamantado | #4', 'Diamantado', 4, 11000, 31000, 2500, 25800],
    ['Diamantado | #5', 'Diamantado', 5, 14000, 42000, 4700, 37000],
    ['Diamantado | #6', 'Diamantado', 6, 17000, 65000, 6400, 57000],
    ['Diamantado | #7', 'Diamantado', 7, 0, 90000, 0, 79000],
    ['Diamantado | #8', 'Diamantado', 8, 21000, 130000, 9000, 119000],
    ['Balín X | #6', 'Balín X', 6, 20000, 0, 5000, 0],
    ['Balín X | #8', 'Balín X', 8, 26000, 0, 7200, 0],
    ['Italiano | #3', 'Italiano', 3, 11000, 0, 1800, 0],
    ['Italiano | #4', 'Italiano', 4, 12000, 0, 2500, 0],
    ['Italiano | #5', 'Italiano', 5, 15000, 0, 4500, 0],
    ['Italiano | #6', 'Italiano', 6, 19000, 0, 0, 0]
  ].map(([label, beadType, size, laminatedPrice, goldPrice, laminatedCost, goldCost]) => ({
    id: label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    label,
    beadType,
    size,
    laminatedPrice,
    goldPrice,
    laminatedCost,
    goldCost
  }));

  const p = (code, name, category, type, bracelets, beads, commonAdjustment, laminatedAdjustment, goldAdjustment, costed, quotable, publish, family, mixedComponent, mixedLaminatedPrice, mixedGoldPrice, note) => ({
    code, name, category, type, status: 'ACTIVO', braceletCount: bracelets, defaultBeads: beads,
    commonAdjustment, laminatedAdjustment, goldAdjustment, costed, quotable, publish, family,
    mixedComponent, mixedLaminatedPrice, mixedGoldPrice, note
  });

  const products = [
    p('AUR-FE-01', 'Virgen del Carmen', 'Protección y Fe', 'SET', 2, 12, 48000, 80000, 280000, 'SI', 'SI', 'SI', 'Virgen del Carmen', 'Dije Virgen del Carmen', 40000, 140000, 'Dije/medalla: completar ajuste de venta una sola vez'),
    p('AUR-FE-02', 'Virgen de Guadalupe', 'Protección y Fe', 'SET', 2, 10, 106000, 100000, 300000, 'SI', 'SI', 'SI', 'Virgen de Guadalupe', 'Dije Virgen de Guadalupe', 50000, 150000, 'Dije/medalla y combinación especial'),
    p('AUR-FE-03', '7 Chakras - Balines Grandes', 'Protección y Fe', 'MODELO', 1, 6, 46000, 0, 0, 'SI', 'SI', 'SI', '7 Chakras', 'NO APLICA', 0, 0, 'Piedras de colores + balines; requiere ajuste modelo'),
    p('AUR-FE-04', 'San Benito', 'Protección y Fe', 'MODELO', 1, 6, 30000, 30000, 140000, 'SI', 'SI', 'SI', 'San Benito', 'Dije San Benito', 30000, 140000, 'Dije San Benito; ajuste confirmado'),
    p('AUR-FE-05', '7 Nudos', 'Protección y Fe', 'MODELO', 1, 6, 0, 0, 0, 'SI', 'SI', 'SI', '7 Nudos', 'NO APLICA', 0, 0, 'Diseño especial; confirmar composición'),
    p('AUR-FE-06', 'San Benito - Pareja Roja', 'Protección y Fe', 'SET', 2, 12, 0, 80000, 320000, 'SI', 'SI', 'SI', 'San Benito', 'Dije San Benito', 40000, 160000, 'Publicado en catálogo público actual; validar fabricación'),
    p('AUR-FE-07', '7 Chakras - Lineal Clásica', 'Protección y Fe', 'MODELO', 1, 8, 46000, 0, 0, 'SI', 'SI', 'SI', '7 Chakras', 'NO APLICA', 0, 0, 'Modelo distinto del AUR-FE-03'),
    p('AUR-FE-08', 'Medalla Roja Dorada', 'Protección y Fe', 'MODELO', 1, 14, 13000, 50000, 140000, 'SI', 'SI', 'SI', 'San Benito', 'Dije San Benito', 50000, 140000, 'Identificar medalla/composición exacta'),
    p('AUR-PAR-01', 'Infinitos Pareja', 'Parejas y Vínculos', 'SET', 2, 0, 0, 80000, 280000, 'SI', 'SI', 'SI', 'Infinito', 'Dije Infinito', 40000, 140000, 'Set de 2; dije infinito'),
    p('AUR-PAR-02', 'Pareja Roja - 3 Balines', 'Parejas y Vínculos', 'SET', 2, 6, 0, 0, 0, 'SI', 'SI', 'SI', 'Pareja Balines', 'NO APLICA', 0, 0, '3 balines por manilla'),
    p('AUR-PAR-03', 'Pareja Iniciales 2 Balines', 'Parejas y Vínculos', 'SET', 2, 4, 0, 0, 0, 'NO', 'NO', 'NO', 'Iniciales', 'NO APLICA', 0, 0, 'NO PUBLICAR / actualmente no se fabrican iniciales'),
    p('AUR-PAR-04', 'Infinito Rosado', 'Parejas y Vínculos', 'MODELO', 1, 6, 0, 45000, 145000, 'SI', 'SI', 'SI', 'Infinito', 'Dije Infinito', 45000, 145000, 'Dije infinito'),
    p('AUR-PAR-05', 'Hilo Rojo Pareja - 1 Balín', 'Parejas y Vínculos', 'SET', 2, 2, 0, 0, 0, 'SI', 'SI', 'SI', 'Hilo Rojo Pareja', 'NO APLICA', 0, 0, 'Set de 2 manillas, 1 balín por manilla'),
    p('AUR-PAR-06', 'Infinito con Neoprenos', 'Parejas y Vínculos', 'SET', 2, 20, 120000, 80000, 280000, 'SI', 'SI', 'SI', 'Infinito', 'Dije Infinito', 40000, 140000, 'Modelo distinto del AUR-PAR-01'),
    p('AUR-PAR-07', 'Pareja Negro y Dorado', 'Parejas y Vínculos', 'SET', 2, 8, 36000, 0, 0, 'SI', 'SI', 'SI', 'Pareja Negro/Dorado', 'NO APLICA', 0, 0, 'Publicado en catálogo público actual'),
    p('AUR-PAR-08', 'Pareja Neoprenos Rojo y Negro', 'Parejas y Vínculos', 'SET', 2, 12, 84000, 0, 0, 'SI', 'SI', 'SI', 'Pareja Neoprenos', 'NO APLICA', 0, 0, 'Publicado en catálogo público actual'),
    p('AUR-FAM-01', 'Familia Roja - 2 Balines', 'Familia y Bebé', 'SET', 3, 6, 0, 0, 0, 'SI', 'SI', 'SI', 'Familia', 'NO APLICA', 0, 0, 'Confirmar número final de manillas al cotizar'),
    p('AUR-FAM-02', 'Set Familiar Rojo', 'Familia y Bebé', 'SET', 3, 14, 0, 0, 0, 'REVISAR', 'REVISAR', 'REVISAR', 'Familia', 'NO APLICA', 0, 0, 'Set de 3; composición mixta'),
    p('AUR-FAM-03', 'Pareja e Hijo', 'Familia y Bebé', 'SET', 3, 15, 0, 0, 0, 'REVISAR', 'REVISAR', 'REVISAR', 'Familia', 'NO APLICA', 0, 0, 'Set de 3; composición mixta'),
    p('AUR-FAM-04', 'Colección Bebé', 'Familia y Bebé', 'COLECCION', 1, 0, 0, 0, 0, 'REVISAR', 'REVISAR', 'REVISAR', 'Bebe', 'NO APLICA', 0, 0, 'Colección: asignar subcódigo al modelo elegido'),
    p('AUR-FAM-05', 'Bebé Individual', 'Familia y Bebé', 'MODELO', 1, 6, 5000, 45000, 145000, 'SI', 'SI', 'SI', 'Bebe', 'NO APLICA', 45000, 145000, 'Modelo bebé; confirmar composición exacta'),
    p('AUR-FAM-06', 'Bebé Roja - 7 Balines', 'Familia y Bebé', 'MODELO', 1, 6, 0, 0, 0, 'SI', 'SI', 'SI', 'Bebe', 'NO APLICA', 0, 0, 'Composición simple de balines + tejido'),
    p('AUR-PER-01', 'Iniciales y Neoprenos', 'Personalizadas', 'MODELO', 1, 0, 0, 0, 0, 'NO', 'NO', 'NO', 'Iniciales', 'NO APLICA', 0, 0, 'NO PUBLICAR / actualmente no se fabrican iniciales'),
    p('AUR-PER-02', '3 Balines Colores', 'Color, Detalles y Combinaciones', 'MODELO', 1, 3, 0, 0, 0, 'SI', 'SI', 'SI', '3 Balines Color', 'NO APLICA', 0, 0, 'Incluye cuentas de color'),
    p('AUR-PER-03', 'Colores - 3 Balines Sencillas', 'Color, Detalles y Combinaciones', 'MODELO', 1, 3, 0, 0, 0, 'SI', 'SI', 'SI', '3 Balines Color', 'NO APLICA', 0, 0, 'Color de hilo no cambia precio salvo excepción'),
    p('AUR-PRE-01', 'Esmeralda y Neoprenos', 'Clásicas y Premium', 'MODELO', 1, 6, 66000, 0, 0, 'SI', 'SI', 'SI', 'Premium', 'NO APLICA', 0, 0, 'Piedra central + neoprenos'),
    p('AUR-PRE-02', 'Balines Italianos Azul', 'Clásicas y Premium', 'MODELO', 1, 14, 18000, 0, 0, 'SI', 'SI', 'SI', 'Azul', 'NO APLICA', 0, 0, 'Tipo italiano; confirmar cantidad'),
    p('AUR-PRE-03', 'Doble Carril', 'Clásicas y Premium', 'MODELO', 1, 60, 0, 0, 0, 'SI', 'SI', 'SI', 'Doble Carril', 'NO APLICA', 0, 0, 'Composición especial'),
    p('AUR-PRE-04', '6 Balines - 7 Neoprenos Negra', 'Clásicas y Premium', 'MODELO', 1, 6, 42000, 0, 0, 'SI', 'SI', 'SI', 'Negra Neoprenos', 'NO APLICA', 0, 0, '6 balines + neoprenos'),
    p('AUR-PRE-05', 'Azul con Detalles Dorados', 'Clásicas y Premium', 'MODELO', 1, 2, 21000, 0, 0, 'SI', 'SI', 'SI', 'Azul', 'NO APLICA', 0, 0, 'Publicado en catálogo público actual'),
    p('AUR-PRE-06', 'Negra con Neoprenos y Balines', 'Clásicas y Premium', 'MODELO', 1, 7, 42000, 0, 0, 'SI', 'SI', 'SI', 'Negra Neoprenos', 'NO APLICA', 0, 0, 'Revisar si se separan composiciones'),
    p('AUR-PRE-07', 'Neoprenos Rosado y Negro', 'Clásicas y Premium', 'MODELO', 2, 12, 60000, 32000, 130000, 'SI', 'SI', 'SI', 'Neoprenos', 'NO APLICA', 0, 0, 'Variación de color sin código nuevo si composición/precio son iguales'),
    p('AUR-PRE-08', 'Azul Masculina', 'Clásicas y Premium', 'MODELO', 1, 2, 21000, 0, 0, 'SI', 'SI', 'SI', 'Azul', 'NO APLICA', 0, 0, 'Publicado en catálogo público actual'),
    p('AUR-PRE-09', 'Negra y Dorada Premium', 'Clásicas y Premium', 'MODELO', 1, 3, 24000, 0, 0, 'SI', 'SI', 'SI', 'Negra Premium', 'NO APLICA', 0, 0, 'Publicado en catálogo público actual'),
    p('AUR-PRE-10', 'Negra Minimalista Dorada', 'Clásicas y Premium', 'MODELO', 1, 7, 42000, 0, 0, 'SI', 'SI', 'SI', 'Negra Minimalista', 'NO APLICA', 0, 0, 'Revisar si se separan composiciones'),
    p('AUR-PRE-11', 'Negra Dorada Premium', 'Clásicas y Premium', 'MODELO', 1, 10, 26000, 0, 0, 'SI', 'SI', 'SI', 'Negra Premium', 'NO APLICA', 0, 0, 'Publicado en catálogo público actual'),
    p('AUR-DEL-01', 'Morada Flor', 'Color, Detalles y Combinaciones', 'MODELO', 1, 3, 6000, 0, 0, 'SI', 'SI', 'SI', 'Flor', 'NO APLICA', 0, 0, 'Flor/cuentas de color'),
    p('AUR-DEL-02', 'Colección Multicolor', 'Color, Detalles y Combinaciones', 'COLECCION', 1, 5, 30000, 0, 0, 'SI', 'SI', 'SI', 'Multicolor', 'NO APLICA', 0, 0, 'Colección: cada diseño debe tener subcódigo'),
    p('AUR-DEL-03', 'Colección Pastel', 'Color, Detalles y Combinaciones', 'COLECCION', 1, 4, 15000, 0, 0, 'SI', 'SI', 'SI', 'Pastel', 'NO APLICA', 0, 0, 'Colección: cada diseño debe tener subcódigo'),
    p('AUR-DIS-01', '5 Balines - 6 Neoprenos Rojo Claro', 'Color, Detalles y Combinaciones', 'MODELO', 1, 5, 30000, 0, 0, 'SI', 'SI', 'SI', 'Neoprenos', 'NO APLICA', 0, 0, '5 balines + 6 neoprenos'),
    p('AUR-DIS-02', '6 Balines Cerrados', 'Color, Detalles y Combinaciones', 'MODELO', 1, 6, 0, 0, 0, 'SI', 'SI', 'SI', 'Balines', 'NO APLICA', 0, 0, '6 balines; diseño sencillo'),
    p('AUR-DIS-03', '7 Balines - 8 Neoprenos', 'Color, Detalles y Combinaciones', 'MODELO', 1, 7, 48000, 0, 0, 'SI', 'SI', 'SI', 'Neoprenos', 'NO APLICA', 0, 0, '7 balines + 8 neoprenos'),
    p('AUR-DIS-04', 'Rondeles y Bola de Fuego', 'Color, Detalles y Combinaciones', 'MODELO', 1, 4, 100000, 0, 0, 'SI', 'SI', 'SI', 'Rondeles', 'NO APLICA', 0, 0, 'Completar ajuste de venta'),
    p('AUR-DIS-05', '5 Balines - 6 Neoprenos Rojo Oscuro', 'Color, Detalles y Combinaciones', 'MODELO', 1, 5, 30000, 0, 0, 'SI', 'SI', 'SI', 'Neoprenos', 'NO APLICA', 0, 0, '5 balines + 6 neoprenos'),
    p('AUR-DIS-06', 'Rondeles', 'Color, Detalles y Combinaciones', 'MODELO', 2, 16, 40000, 0, 0, 'SI', 'SI', 'SI', 'Rondeles', 'NO APLICA', 0, 0, 'Imagen corregida; envío gratis desde $250.000')
  ];

  root.AureaQuoteSeed = Object.freeze({ seed: 1, rules, variants, products });
}(typeof window !== 'undefined' ? window : globalThis));
