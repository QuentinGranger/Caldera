import 'server-only';
import { cache } from 'react';
import { getSiteNavigation } from '@/data/navigation';
import { getPrisma } from '@/lib/db/prisma';
import { merchandisingWhere } from '@/lib/catalog/merchandisingQueries';

export const getUpdateLinks = cache(async () => {
  const [navigation, restock] = await Promise.all([
    getSiteNavigation(),
    merchandisingWhere('retour-en-stock')
      .then((where) => getPrisma().product.count({ where }))
      .catch(() => 0),
  ]);
  return [
    ...navigation.listings.filter((link) => link.href === '/nouveautes'),
    ...(restock
      ? [{ href: '/selections/retour-en-stock', label: 'Retours en stock' }]
      : []),
    ...(navigation.calendar ? [navigation.calendar] : []),
  ];
});
