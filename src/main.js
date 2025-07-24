/**
 * Функция для расчета прибыли
 * @param item элемент из purchase.items
 * @param product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(item, product) {
    const saleWithDiscount = item.sale_price * item.quantity * (1 - item.discount / 100);
    const cost = product.purchase_price * item.quantity;
    return saleWithDiscount - cost;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    const base = 1000;
    return Math.round(base * (1 - index / total)); // Чем выше по прибыли, тем больше бонус
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options = {}) {
    if (!data || !data.purchase_records || !data.sellers || !data.products) {
        throw new Error("Некорректные входные данные");
    }

    const sellerMap = Object.fromEntries(data.sellers.map(s => [s.id, s]));
    const productMap = Object.fromEntries(data.products.map(p => [p.sku, p]));

    const stats = {}; // seller_id → summary

    for (const record of data.purchase_records) {
        const sellerId = record.seller_id;
        if (!sellerMap[sellerId]) continue;

        if (!stats[sellerId]) {
            stats[sellerId] = {
                seller_id: sellerId,
                name: `${sellerMap[sellerId].first_name} ${sellerMap[sellerId].last_name}`,
                revenue: 0,
                profit: 0,
                sales_count: 0,
                product_sales: {}, // sku -> qty
            };
        }

        const summary = stats[sellerId];

        for (const item of record.items) {
            const product = productMap[item.sku];
            if (!product) continue;

            const discountedRevenue = item.sale_price * item.quantity * (1 - item.discount / 100);
            const profit = calculateSimpleRevenue(item, product);

            summary.revenue += discountedRevenue;
            summary.profit += profit;
            summary.sales_count += item.quantity;
            summary.product_sales[item.sku] = (summary.product_sales[item.sku] || 0) + item.quantity;
        }
    }

    const result = Object.values(stats);

    result.forEach(stat => {
        stat.top_products = Object.entries(stat.product_sales)
            .sort(([, aQty], [, bQty]) => bQty - aQty)
            .slice(0, 10)
            .map(([sku, quantity]) => ({ sku, quantity }));
        delete stat.product_sales; // очистка временного поля
    });

    // сортировка по прибыли и бонус
    result.sort((a, b) => b.profit - a.profit);
    result.forEach((stat, index) => {
        stat.bonus = calculateBonusByProfit(index, result.length, stat);
    });

    return result;
}