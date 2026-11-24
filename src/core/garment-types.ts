import type { GarmentCategory } from './entities';

export interface GarmentTypeOption {
  value: string;
  label: string;
  category: GarmentCategory;
}

export interface GarmentTypeGroup {
  label: string;
  options: GarmentTypeOption[];
}

export const garmentTypeGroups: GarmentTypeGroup[] = [
  {
    label: 'Partes de arriba',
    options: [
      { value: 'polera', label: 'Polera', category: 'top' },
      { value: 'polera manga corta', label: 'Polera manga corta', category: 'top' },
      { value: 'polera manga larga', label: 'Polera manga larga', category: 'top' },
      { value: 'polera sin mangas', label: 'Polera sin mangas', category: 'top' },
      { value: 'polera musculosa', label: 'Polera musculosa', category: 'top' },
      { value: 'polera con cuello', label: 'Polera con cuello', category: 'top' },
      { value: 'polera deportiva', label: 'Polera deportiva', category: 'top' },
      { value: 'beatle', label: 'Beatle / cuello alto', category: 'top' },
      { value: 'camisa', label: 'Camisa', category: 'top' },
      { value: 'chaleco', label: 'Chaleco', category: 'top' },
    ],
  },
  {
    label: 'Partes de abajo',
    options: [
      { value: 'jeans', label: 'Jeans', category: 'bottom' },
      { value: 'jeans cargo', label: 'Jeans cargo', category: 'bottom' },
      { value: 'pantalón', label: 'Pantalón', category: 'bottom' },
      { value: 'pantalón cargo', label: 'Pantalón cargo', category: 'bottom' },
      { value: 'pantalón de traje', label: 'Pantalón de traje', category: 'bottom' },
      { value: 'jogger', label: 'Jogger', category: 'bottom' },
      { value: 'buzo', label: 'Buzo', category: 'bottom' },
      { value: 'short', label: 'Short', category: 'bottom' },
      { value: 'short cargo', label: 'Short cargo', category: 'bottom' },
      { value: 'short deportivo', label: 'Short deportivo', category: 'bottom' },
      { value: 'traje de baño', label: 'Traje de baño', category: 'bottom' },
    ],
  },
  {
    label: 'Vestidos y faldas',
    options: [
      { value: 'vestido', label: 'Vestido', category: 'dress-skirt' },
      { value: 'falda', label: 'Falda', category: 'dress-skirt' },
    ],
  },
  {
    label: 'Chaquetas y abrigos',
    options: [
      { value: 'chaqueta', label: 'Chaqueta', category: 'outerwear' },
      { value: 'chaqueta de cuero', label: 'Chaqueta de cuero', category: 'outerwear' },
      { value: 'chaqueta de mezclilla', label: 'Chaqueta de mezclilla', category: 'outerwear' },
      { value: 'abrigo', label: 'Abrigo', category: 'outerwear' },
      { value: 'abrigo deportivo', label: 'Abrigo deportivo', category: 'outerwear' },
    ],
  },
  {
    label: 'Calzado',
    options: [
      { value: 'zapatillas', label: 'Zapatillas', category: 'footwear' },
      { value: 'zapatos', label: 'Zapatos', category: 'footwear' },
      { value: 'botas', label: 'Botas', category: 'footwear' },
      { value: 'sandalias', label: 'Sandalias', category: 'footwear' },
    ],
  },
  {
    label: 'Accesorios',
    options: [
      { value: 'accesorio', label: 'Accesorio', category: 'accessory' },
      { value: 'cartera', label: 'Cartera', category: 'accessory' },
      { value: 'aros', label: 'Aros', category: 'accessory' },
      { value: 'cadena', label: 'Cadena', category: 'accessory' },
      { value: 'pulsera', label: 'Pulsera', category: 'accessory' },
      { value: 'pulsera con pinchos', label: 'Pulsera con pinchos', category: 'accessory' },
      { value: 'choker', label: 'Choker', category: 'accessory' },
      { value: 'bufanda', label: 'Bufanda', category: 'accessory' },
      { value: 'cinturón', label: 'Cinturón', category: 'accessory' },
      { value: 'gorro', label: 'Gorro', category: 'accessory' },
      { value: 'bolso', label: 'Bolso', category: 'accessory' },
    ],
  },
];

export const garmentTypeOptions = garmentTypeGroups.flatMap((group) => group.options);

export function categoryForGarmentType(
  value: string,
  fallback: GarmentCategory = 'top',
): GarmentCategory {
  return garmentTypeOptions.find((option) => option.value === value)?.category ?? fallback;
}
