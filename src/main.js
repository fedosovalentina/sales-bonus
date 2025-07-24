/**
 * Функция для расчета прибыли
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    const discount = 1 - (purchase.discount / 100);
    return purchase.sale_price * purchase.quantity * discount;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    if (index === 0) {
        return seller.profit * 0.15;
    } else if (index === 1 || index === 2) {
        return seller.profit * 0.10;
    } else if (index === total - 1) {
        return 0;
    } else {
        return seller.profit * 0.05;
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // Шаг 1. Проверка входных данных
    if (!data
        || !Array.isArray(data.sellers) || data.sellers.length === 0
        || !Array.isArray(data.products) || data.products.length === 0
        || !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
    ) {
        throw new Error("Некорректные входные данные");
    }

    // Шаг 2. Проверка наличия опций
    const { calculateRevenue, calculateBonus } = options || {};
    if (!calculateRevenue || !calculateBonus) {
        throw new Error("calculateRevenue и calculateBonus обязательны");
    }
    if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
        throw new Error("calculateRevenue и calculateBonus должны быть функциями");
    }

    // Шаг 3. Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {} // sku -> quantity
    }));

    // Шаг 4. Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = {};
    sellerStats.forEach(seller => {
        sellerIndex[seller.id] = seller;
    });

    const productIndex = {};
    data.products.forEach(product => {
        productIndex[product.sku] = product;
    });

    // Шаг 5. Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => { // Чек 
        const seller = sellerIndex[record.seller_id]; // Продавец
        if (!seller) return;

        // Увеличить количество продаж 
        seller.sales_count += 1;
        // Увеличить общую сумму всех продаж 
        seller.revenue += record.total_amount;

        // Расчёт прибыли для каждого товара
        record.items.forEach(item => {
            const product = productIndex[item.sku]; // Товар
            if (!product) return;

            // Посчитать себестоимость
            const cost = product.purchase_price * item.quantity;
            // Выручка с учетом скидки
            const revenue = calculateRevenue(item, product);
            // Прибыль
            const profit = revenue - cost;

            // Увеличить общую накопленную прибыль
            seller.profit += profit;

            // Учёт количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            // Увеличить число проданных товаров
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // Шаг 6. Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // Шаг 7. Назначение премий на основе ранжирования
    sellerStats.forEach((seller, index) => {
        // Считаем бонус
        seller.bonus = calculateBonus(index, sellerStats.length, seller);

        // Формируем топ-10 товаров
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    // Шаг 8. Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.id, // Идентификатор продавца
        name: seller.name, // Имя и фамилия продавца
        revenue: +seller.revenue.toFixed(2), // Общая выручка
        profit: +seller.profit.toFixed(2), // Прибыль
        sales_count: seller.sales_count, // Кол-во продаж
        top_products: seller.top_products, // Топ-10 товаров
        bonus: +seller.bonus.toFixed(2) // Бонус
    }));
}