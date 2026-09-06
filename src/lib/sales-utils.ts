export const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString()
}

export const getProductTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'service':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'inventory':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'noninventory':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}
