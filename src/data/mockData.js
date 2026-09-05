export const initialOrders = [
  {
    id: "#1023",
    customer: "João Silva",
    supplier: "Loja Online",
    operation: "Venda",
    status: "waiting",
    date: "05/09/2026",
    total: 229.7,
    items: [
      { productId: "P001", product: "Camiseta preta", quantity: 1, unitPrice: 59.9 },
      { productId: "P002", product: "Boné", quantity: 1, unitPrice: 49.9 },
      { productId: "P003", product: "Tênis", quantity: 2, unitPrice: 59.95 },
    ],
  },
  {
    id: "#1024",
    customer: "Maria Santos",
    supplier: "Marketplace",
    operation: "Venda",
    status: "separating",
    date: "05/09/2026",
    total: 1299.9,
    items: [{ productId: "P004", product: "Celular", quantity: 1, unitPrice: 1299.9 }],
  },
  {
    id: "#1025",
    customer: "Miguel Oliveira",
    supplier: "Loja Física",
    operation: "Venda",
    status: "completed",
    date: "04/09/2026",
    total: 59.88,
    items: [{ productId: "P005", product: "Coca Cola Lata", quantity: 12, unitPrice: 4.99 }],
  },
  {
    id: "#1026",
    customer: "Pedro Costa",
    supplier: "Loja Online",
    operation: "Venda",
    status: "shipped",
    date: "04/09/2026",
    total: 249.8,
    items: [
      { productId: "P006", product: "Carregador", quantity: 1, unitPrice: 69.9 },
      { productId: "P007", product: "Teclado", quantity: 1, unitPrice: 179.9 },
    ],
  },
  {
    id: "#1027",
    customer: "Ana Souza",
    supplier: "Marketplace",
    operation: "Venda",
    status: "cancelled",
    date: "03/09/2026",
    total: 189.8,
    items: [
      { productId: "P008", product: "Mouse Gamer", quantity: 1, unitPrice: 129.9 },
      { productId: "P009", product: "Mousepad", quantity: 1, unitPrice: 59.9 },
    ],
  },
]

export const initialInventory = [
  { id: "P001", name: "Camiseta preta", quantity: 91, max: 150, min: 30, unitPrice: 59.9, active: true },
  { id: "P002", name: "Boné", quantity: 20, max: 100, min: 25, unitPrice: 49.9, active: true },
  { id: "P003", name: "Tênis", quantity: 45, max: 80, min: 20, unitPrice: 59.95, active: true },
  { id: "P004", name: "Celular", quantity: 12, max: 60, min: 15, unitPrice: 1299.9, active: true },
  { id: "P005", name: "Coca Cola Lata", quantity: 120, max: 200, min: 40, unitPrice: 4.99, active: true },
]

export const initialUsers = [
  {
    id: "U001",
    name: "Bruno Silva",
    email: "bruno@modusdestinatio.com",
    phone: "(11) 99999-9999",
    role: "Administrador",
    type: "admin",
    status: "active",
    password: "123456",
  },
]

export const initialTasks = [
  { id: "T001", title: "Conferir pedidos pendentes", done: false },
  { id: "T002", title: "Revisar itens com estoque baixo", done: false },
  { id: "T003", title: "Atualizar inventário", done: true },
]
