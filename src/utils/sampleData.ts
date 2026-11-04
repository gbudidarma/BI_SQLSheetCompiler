import { SampleDataset } from '../types';

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: 'retail_ecommerce',
    title: 'Global Retail & Products',
    description: 'Relational workbook with sales transactions and product catalog. Perfect for JOINs and revenue analysis.',
    badge: '2 Sheets · 30 Rows',
    tables: [
      {
        sheetName: 'Orders',
        tableName: 'sales_orders',
        data: [
          { order_id: 1001, customer_name: 'Sophia Martinez', product_id: 'P101', units_sold: 3, unit_price: 189.99, discount_pct: 0.05, order_date: '2024-01-15', region: 'North America', payment_method: 'Credit Card' },
          { order_id: 1002, customer_name: 'Liam Chen', product_id: 'P103', units_sold: 1, unit_price: 849.00, discount_pct: 0.10, order_date: '2024-01-18', region: 'Asia-Pacific', payment_method: 'PayPal' },
          { order_id: 1003, customer_name: 'Elena Rostova', product_id: 'P102', units_sold: 5, unit_price: 49.50, discount_pct: 0.00, order_date: '2024-01-22', region: 'Europe', payment_method: 'Credit Card' },
          { order_id: 1004, customer_name: 'Marcus Brody', product_id: 'P105', units_sold: 2, unit_price: 299.00, discount_pct: 0.15, order_date: '2024-02-02', region: 'North America', payment_method: 'Apple Pay' },
          { order_id: 1005, customer_name: 'Amara Okafor', product_id: 'P104', units_sold: 4, unit_price: 120.00, discount_pct: 0.00, order_date: '2024-02-09', region: 'Africa', payment_method: 'Wire Transfer' },
          { order_id: 1006, customer_name: 'Lucas Silva', product_id: 'P101', units_sold: 6, unit_price: 189.99, discount_pct: 0.20, order_date: '2024-02-14', region: 'South America', payment_method: 'Credit Card' },
          { order_id: 1007, customer_name: 'Zoe Vance', product_id: 'P103', units_sold: 2, unit_price: 849.00, discount_pct: 0.05, order_date: '2024-02-20', region: 'North America', payment_method: 'Credit Card' },
          { order_id: 1008, customer_name: 'Kenji Sato', product_id: 'P106', units_sold: 1, unit_price: 1299.00, discount_pct: 0.00, order_date: '2024-03-01', region: 'Asia-Pacific', payment_method: 'PayPal' },
          { order_id: 1009, customer_name: 'Clara Dupont', product_id: 'P102', units_sold: 8, unit_price: 49.50, discount_pct: 0.10, order_date: '2024-03-05', region: 'Europe', payment_method: 'Credit Card' },
          { order_id: 1010, customer_name: 'Sophia Martinez', product_id: 'P105', units_sold: 1, unit_price: 299.00, discount_pct: 0.00, order_date: '2024-03-12', region: 'North America', payment_method: 'Apple Pay' },
          { order_id: 1011, customer_name: 'Tariq Al-Mansoor', product_id: 'P104', units_sold: 3, unit_price: 120.00, discount_pct: 0.05, order_date: '2024-03-18', region: 'Middle East', payment_method: 'Wire Transfer' },
          { order_id: 1012, customer_name: 'Liam Chen', product_id: 'P106', units_sold: 1, unit_price: 1299.00, discount_pct: 0.10, order_date: '2024-03-25', region: 'Asia-Pacific', payment_method: 'PayPal' },
        ],
      },
      {
        sheetName: 'Catalog',
        tableName: 'product_catalog',
        data: [
          { product_id: 'P101', product_name: 'Ergonomic Desk Chair', category: 'Office Furniture', supplier: 'SteelWorks Ltd', stock_level: 45, rating: 4.8 },
          { product_id: 'P102', product_name: 'Precision Desk Mat', category: 'Accessories', supplier: 'FlexCraft Co', stock_level: 180, rating: 4.6 },
          { product_id: 'P103', product_name: 'UltraWide Curved Monitor 34"', category: 'Electronics', supplier: 'AcuVision Corp', stock_level: 18, rating: 4.9 },
          { product_id: 'P104', product_name: 'Mechanical Keyboard RGB', category: 'Electronics', supplier: 'KeyMaster IO', stock_level: 64, rating: 4.7 },
          { product_id: 'P105', product_name: 'Active Noise-Cancelling Pods', category: 'Audio', supplier: 'SonicWave Labs', stock_level: 32, rating: 4.5 },
          { product_id: 'P106', product_name: 'Carbon Fiber Sit-Stand Desk', category: 'Office Furniture', supplier: 'SteelWorks Ltd', stock_level: 12, rating: 4.9 },
        ],
      },
    ],
    starterQueries: [
      {
        title: 'Revenue & Volume by Category (JOIN)',
        sql: `SELECT 
  c.category,
  COUNT(o.order_id) AS total_orders,
  SUM(o.units_sold) AS total_units_sold,
  ROUND(SUM(o.units_sold * o.unit_price * (1 - o.discount_pct)), 2) AS net_revenue_usd
FROM sales_orders AS o
INNER JOIN product_catalog AS c ON o.product_id = c.product_id
GROUP BY c.category
ORDER BY net_revenue_usd DESC;`,
        description: 'Computes total net revenue aggregated across distinct product categories using an INNER JOIN.',
      },
      {
        title: 'Top Customers by Lifetime Spend',
        sql: `SELECT 
  customer_name,
  region,
  COUNT(order_id) AS order_count,
  ROUND(SUM(units_sold * unit_price * (1 - discount_pct)), 2) AS total_spent_usd
FROM sales_orders
GROUP BY customer_name, region
ORDER BY total_spent_usd DESC;`,
        description: 'Finds the highest spending individual buyers across regions.',
      },
      {
        title: 'Inventory Health vs. Average Rating',
        sql: `SELECT 
  product_name,
  category,
  stock_level,
  rating,
  CASE 
    WHEN stock_level <= 20 THEN 'CRITICAL LOW'
    WHEN stock_level <= 50 THEN 'MODERATE'
    ELSE 'HEALTHY'
  END AS inventory_status
FROM product_catalog
ORDER BY stock_level ASC;`,
        description: 'Evaluates inventory thresholds using SQL conditional CASE WHEN logic.',
      },
    ],
  },
  {
    id: 'workforce_talent',
    title: 'Workforce & Departments',
    description: 'Human resources headcount, salaries, performance metrics, and departmental budgets.',
    badge: '2 Sheets · 18 Rows',
    tables: [
      {
        sheetName: 'Staff',
        tableName: 'employees',
        data: [
          { emp_id: 'E01', full_name: 'Alex Rivera', dept_id: 'D10', job_title: 'Staff Platform Engineer', salary_usd: 165000, performance_score: 4.8, hire_date: '2021-03-15', remote_status: 'Remote' },
          { emp_id: 'E02', full_name: 'Devon Miller', dept_id: 'D10', job_title: 'Frontend Architect', salary_usd: 152000, performance_score: 4.6, hire_date: '2022-01-10', remote_status: 'Hybrid' },
          { emp_id: 'E03', full_name: 'Fatima Zahra', dept_id: 'D20', job_title: 'Senior Product Manager', salary_usd: 148000, performance_score: 4.9, hire_date: '2020-08-01', remote_status: 'Onsite' },
          { emp_id: 'E04', full_name: 'George Park', dept_id: 'D30', job_title: 'Lead Financial Analyst', salary_usd: 125000, performance_score: 4.2, hire_date: '2023-04-12', remote_status: 'Hybrid' },
          { emp_id: 'E05', full_name: 'Hanna Lindqvist', dept_id: 'D10', job_title: 'Data Engineer', salary_usd: 138000, performance_score: 4.5, hire_date: '2022-09-18', remote_status: 'Remote' },
          { emp_id: 'E06', full_name: 'Ian Gallagher', dept_id: 'D40', job_title: 'Growth Marketing Lead', salary_usd: 118000, performance_score: 4.1, hire_date: '2023-02-28', remote_status: 'Remote' },
          { emp_id: 'E07', full_name: 'Jasmine Kaur', dept_id: 'D20', job_title: 'Product Designer', salary_usd: 115000, performance_score: 4.7, hire_date: '2022-11-05', remote_status: 'Hybrid' },
          { emp_id: 'E08', full_name: 'Kai Takahashi', dept_id: 'D10', job_title: 'Security Operations Specialist', salary_usd: 142000, performance_score: 4.4, hire_date: '2021-07-20', remote_status: 'Remote' },
        ],
      },
      {
        sheetName: 'Departments',
        tableName: 'departments',
        data: [
          { dept_id: 'D10', department_name: 'Core Engineering', budget_usd: 1200000, headcount_target: 12, location: 'San Francisco, CA' },
          { dept_id: 'D20', department_name: 'Product & Design', budget_usd: 650000, headcount_target: 6, location: 'New York, NY' },
          { dept_id: 'D30', department_name: 'Finance & Strategy', budget_usd: 480000, headcount_target: 4, location: 'Chicago, IL' },
          { dept_id: 'D40', department_name: 'Growth & Marketing', budget_usd: 520000, headcount_target: 5, location: 'Austin, TX' },
        ],
      },
    ],
    starterQueries: [
      {
        title: 'Department Headcount & Average Compensation',
        sql: `SELECT 
  d.department_name,
  d.location,
  COUNT(e.emp_id) AS current_headcount,
  d.headcount_target,
  ROUND(AVG(e.salary_usd), 2) AS avg_salary_usd,
  SUM(e.salary_usd) AS total_payroll_usd,
  d.budget_usd
FROM departments AS d
LEFT JOIN employees AS e ON d.dept_id = e.dept_id
GROUP BY d.department_name, d.location, d.headcount_target, d.budget_usd
ORDER BY total_payroll_usd DESC;`,
        description: 'Aggregates salary payroll against allocated department budgets with a LEFT JOIN.',
      },
      {
        title: 'Top Performers (Score >= 4.5)',
        sql: `SELECT 
  full_name,
  job_title,
  salary_usd,
  performance_score,
  remote_status
FROM employees
WHERE performance_score >= 4.5
ORDER BY performance_score DESC, salary_usd DESC;`,
        description: 'Filters elite team members with highest appraisal score.',
      },
    ],
  },
];
