/**
 * The module list published in the owner's product document
 * (NB Engineering Tools for AutoCAD.pdf, Final version-13082026, pages 3-4).
 *
 * These are the module names and their stated purpose, nothing more. No claim is
 * made here about the accuracy, speed or code-compliance of what any module
 * produces, because none of that has been tested by this site.
 *
 * Kept in the front end rather than the database because it must match the
 * shipped software exactly; changing it is a deliberate edit tied to a release,
 * not routine content editing.
 */
export type ProductModule = { name: string; purpose: string; group: string };

export const PRODUCT_MODULES: ProductModule[] = [
  { name: 'NBFooting', group: 'Footing & Foundation', purpose: 'Isolated footing design, reinforcement, plan, section এবং estimate workflow' },
  { name: 'NBCombinedFooting', group: 'Footing & Foundation', purpose: 'Combined footing design ও drawing' },
  { name: 'NBPileCap', group: 'Footing & Foundation', purpose: 'Pile cap plan, section, code/design checks এবং reinforcement' },
  { name: 'NBPileCenter', group: 'Footing & Foundation', purpose: 'Pile center/layout related workflow' },
  { name: 'NBLoadPile', group: 'Footing & Foundation', purpose: 'Load ও pile-foundation related layout/drawing' },
  { name: 'NBFootingLoadArea', group: 'Footing & Foundation', purpose: 'Footing/column load-area related workflow' },
  { name: 'NBFootingExcel', group: 'Footing & Foundation', purpose: 'Footing information/estimate export workflow' },

  { name: 'NBSoilCapacity', group: 'Geotechnical', purpose: 'Soil bearing capacity related calculation' },
  { name: 'NBGeotech', group: 'Geotechnical', purpose: 'Geotechnical engineering workflow' },

  { name: 'NBBeam', group: 'Beam & Slab', purpose: 'RCC beam related engineering drawing' },
  { name: 'NBBeamSpan', group: 'Beam & Slab', purpose: 'Beam span/column measurement workflow' },
  { name: 'NBGBDraw', group: 'Beam & Slab', purpose: 'Grade beam drawing automation' },
  { name: 'NBSlabDraw', group: 'Beam & Slab', purpose: 'Slab reinforcement/crank rod drawing automation' },
  { name: 'NBSTRD', group: 'Beam & Slab', purpose: 'Slab thickness/rod related structural design workflow' },
  { name: 'NBDevLength', group: 'Beam & Slab', purpose: 'Reinforcement development length calculation' },

  { name: 'NBColumnLayout', group: 'Layout, Grid & Schedule', purpose: 'Column layout preparation' },
  { name: 'NBColumnLoad', group: 'Layout, Grid & Schedule', purpose: 'Column load related workflow' },
  { name: 'NBColumnSchedule', group: 'Layout, Grid & Schedule', purpose: 'Column schedule preparation' },
  { name: 'NBGrid', group: 'Layout, Grid & Schedule', purpose: 'Structural grid-line automation' },
  { name: 'NBNameText', group: 'Layout, Grid & Schedule', purpose: 'Footing/column naming and text automation' },
  { name: 'NBQuickBlock', group: 'Layout, Grid & Schedule', purpose: 'Quick AutoCAD block productivity tool' },

  { name: 'NBRM', group: 'Dimension Utilities', purpose: 'Room name ও architectural feet-inch room measurement' },
  { name: 'NBDFM', group: 'Dimension Utilities', purpose: 'Dimension/drafting utility' },
  { name: 'NBDITM', group: 'Dimension Utilities', purpose: 'Engineering dimension/conversion utility' },

  { name: 'NBMouza', group: 'Mouza & OCR', purpose: 'Mouza drawing/OCR related engineering drafting workflow' },

  { name: 'NBCore', group: 'License & System', purpose: 'Security, initialization ও compiled-runtime support module' },
];

/** 25 engineering/productivity modules plus one core/security module. */
export const MODULE_COUNT = PRODUCT_MODULES.length;
