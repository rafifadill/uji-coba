import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "./utils/api"; // pastikan path benar

const OrdersPage = ({ darkMode }) => {
  const [orders, setOrders] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusToEdit, setStatusToEdit] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCar, setFilterCar] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", variant: "success" });
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [showPaymentStatusModal, setShowPaymentStatusModal] = useState(false);
  const [paymentStatusToEdit, setPaymentStatusToEdit] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeTab, setActiveTab] = useState("all");

  const token = localStorage.getItem("token");

  // 1. Deklarasikan fetchOrders dan fetchCars di sini
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/orders/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      setOrders([]);
      showToast("Gagal memuat data pesanan!", "danger");
    } finally {
      setLoading(false);
    }
  };

  const fetchCars = async () => {
    try {
      const res = await axios.get(`${API_URL}/layanan`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCars(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      setCars([]);
    }
  };

  // 2. Baru gunakan di useEffect
  useEffect(() => {
    fetchOrders();
    fetchCars();
  }, []); // atau tambahkan dependency jika perlu

  const showToast = (message, variant = "success") => {
    setToast({ show: true, message, variant });
    if (window.__toastTimeout) clearTimeout(window.__toastTimeout);
    window.__toastTimeout = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 2500);
  };
 
  // Filter & Search & Date
  const filteredOrders = orders
    .filter((order) => {
      const searchLower = search.toLowerCase();
      const matchSearch =
        (order.user?.name?.toLowerCase() || "").includes(searchLower) ||
        (order.layanan?.nama?.toLowerCase() || "").includes(searchLower) ||
        order.id.toString().includes(searchLower);
      const matchStatus =
        filterStatus === "all" || (order.status || "").toLowerCase() === filterStatus;
      const matchCar =
        filterCar === "all" || (order.layanan?.id?.toString() === filterCar);
      const matchPayment =
        filterPayment === "all" || (order.payment_method || "") === filterPayment;
      let matchDate = true;
      if (dateFrom) {
        matchDate =
          matchDate &&
          moment(order.createdAt || order.created_at).isSameOrAfter(moment(dateFrom), "day");
      }
      if (dateTo) {
        matchDate =
          matchDate &&
          moment(order.createdAt || order.created_at).isSameOrBefore(moment(dateTo), "day");
      }
      return matchSearch && matchStatus && matchCar && matchPayment && matchDate;
    });

  // Sorting
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const { key, direction } = sortConfig;
    let valA, valB;
    if (key === "user") {
      valA = a.user?.name || "";
      valB = b.user?.name || "";
    } else if (key === "layanan") {
      valA = a.layanan?.nama || "";
      valB = b.layanan?.nama || "";
    } else if (key === "total_price") {
      valA = Number(a.total_price) || 0;
      valB = Number(b.total_price) || 0;
    } else if (key === "createdAt") {
      valA = new Date(a.createdAt || a.created_at);
      valB = new Date(b.createdAt || b.created_at);
    } else {
      valA = a[key];
      valB = b[key];
    }
    if (valA < valB) return direction === "asc" ? -1 : 1;
    if (valA > valB) return direction === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedOrders.length / pageSize);
  const pagedOrders = sortedOrders.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="ms-1 text-muted" />;
    return sortConfig.direction === "asc" ? (
      <FaSortUp className="ms-1" />
    ) : (
      <FaSortDown className="ms-1" />
    );
  };

  // CSV Export
  const csvHeaders = [
    { label: "No. Pesanan", key: "id" },
    { label: "Nama Pelanggan", key: "user_name" },
    { label: "Kendaraan", key: "car_name" },
    { label: "Tanggal Mulai Sewa", key: "pickup_date" },
    { label: "Tanggal Selesai Sewa", key: "return_date" },
    { label: "Durasi (Hari)", key: "duration" },
    { label: "Total Pembayaran", key: "total_price" },
    { label: "Status Pesanan", key: "status" },
    { label: "Status Pembayaran", key: "payment_status" },
    { label: "Metode Pembayaran", key: "payment_method" },
    { label: "Tanggal Dibuat", key: "created_at" },
    { label: "Catatan", key: "notes" }
  ];

  const formatCSVData = (orders) => {
    return orders.map((order) => ({
      id: order.id || '',
      user_name: order.user?.name || '',
      car_name: order.layanan?.nama || '',
      pickup_date: formatDate(order.pickup_date),
      return_date: formatDate(order.return_date),
      duration: order.pickup_date && order.return_date
        ? moment(order.return_date).diff(moment(order.pickup_date), "days")
        : '',
      total_price: formatCurrency(order.total_price),
      status: formatStatus(order.status),
      payment_status: formatPaymentStatus(order.payment_status),
      payment_method: order.payment_method || '',
      created_at: order.createdAt 
        ? moment(order.createdAt).format("DD/MM/YYYY HH:mm")
        : '',
      notes: order.additional_notes || ''
    }));
  };

  // Excel Export
  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(formatCSVData(sortedOrders));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pesanan");
    XLSX.writeFile(wb, `daftar-pesanan-${moment().format("DDMMYYYY")}.xlsx`);
  };

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    doc.setFontSize(14);
    doc.text("Daftar Pesanan", 14, 14);
    autoTable(doc, {
      head: [csvHeaders.map(h => h.label)],
      body: formatCSVData(sortedOrders).map(row => csvHeaders.map(h => row[h.key])),
      startY: 20,
      styles: { fontSize: 10 },
      margin: { left: 14, right: 14 }
    });
    doc.save(`daftar-pesanan-${moment().format("DDMMYYYY")}.pdf`);
  };

  // Bulk Action
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(pagedOrders.map(o => o.id));
    } else {
      setSelectedIds([]);
    }
  };
  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    confirmed: orders.filter(o => o.status === "confirmed").length,
    completed: orders.filter(o => o.status === "completed").length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
  };

  const statusDistribution = [
    { status: "completed", count: stats.completed, label: "Selesai", color: "success", icon: <FaCheckCircle className="text-success me-1" /> },
    { status: "confirmed", count: stats.confirmed, label: "Dikonfirmasi", color: "info", icon: <FaClipboardList className="text-info me-1" /> },
    { status: "pending", count: stats.pending, label: "Pending", color: "warning", icon: <FaClock className="text-warning me-1" /> },
    { status: "cancelled", count: stats.cancelled, label: "Dibatalkan", color: "danger", icon: <FaTimesCircle className="text-danger me-1" /> },
  ];

  const handleShowDetail = async (order) => {
    setDetailLoading(true);
    setSelectedOrder(order);
    setShowDetail(true);
    setDetailLoading(false);
  };

  const handlePrintInvoice = (order) => {
    showToast("Fitur cetak invoice belum tersedia.", "info");
  };

  // Filter by tab
  const filteredByTab = activeTab === "all"
    ? pagedOrders
    : pagedOrders.filter((order) => order.status === activeTab);

  return (
    <Container fluid className={`${darkMode ? "bg-dark text-light" : "bg-light"} min-vh-100 p-4`}>
      {/* Header */}
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="fw-bold mb-1"><FaClipboardList className="me-2 text-primary" />Manajemen Pesanan</h2>
          <div className="text-muted">Kelola dan pantau seluruh pesanan rental mobil</div>
        </Col>
        <Col xs="auto" className="d-flex gap-2">
          <Dropdown>
            <Dropdown.Toggle variant="primary" className="d-flex align-items-center">
              <FaDownload className="me-2" /> Export
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item as="div">
                <CSVLink
                  data={formatCSVData(sortedOrders)}
                  headers={csvHeaders}
                  filename={`daftar-pesanan-${moment().format("DDMMYYYY")}.csv`}
                  className="text-decoration-none text-dark d-block"
                  separator=";"
                  enclosingCharacter={'"'}
                >
                  <FaFileCsv className="me-2 text-success" /> CSV
                </CSVLink>
              </Dropdown.Item>
              <Dropdown.Item onClick={handleExportExcel}>
                <FaFileCsv className="me-2 text-info" /> Excel
              </Dropdown.Item>
              <Dropdown.Item onClick={handleExportPDF}>
                <FaFilePdf className="me-2 text-danger" /> PDF
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </Col>
      </Row>

      {/* Statistik Modern */}
<Row className="mb-4 g-4">
  <Col xl={3} lg={6} md={6} sm={12}>
    <Card className="stat-card-ultra border-0 h-100 overflow-hidden">
      <Card.Body className="p-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h6 className="text-uppercase text-muted mb-2 fw-semibold small">Total Pesanan</h6>
            <h2 className="mb-0 fw-bold">{stats.total}</h2>
            <small className="text-primary fw-semibold">
              <FaArrowUp className="me-1 text-primary" />
              {stats.total > 0 ? ((stats.completed + stats.pending + stats.confirmed + stats.cancelled) / stats.total * 100).toFixed(1) : 0}% dari total
            </small>
          </div>
          <div className="icon-shape bg-gradient-primary rounded-3 stat-icon">
            <FaClipboardList className="text-white" style={{ fontSize: "2rem" }} />
          </div>
        </div>
        <div className="progress mt-3" style={{ height: '4px' }}>
          <div 
            className="progress-bar bg-gradient-primary" 
            role="progressbar" 
            style={{ width: '100%' }} 
            aria-valuenow={stats.total} 
            aria-valuemin="0" 
            aria-valuemax={stats.total}
          ></div>
        </div>
      </Card.Body>
    </Card>
  </Col>
  <Col xl={3} lg={6} md={6} sm={12}>
    <Card className="stat-card-ultra border-0 h-100 overflow-hidden">
      <Card.Body className="p-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h6 className="text-uppercase text-muted mb-2 fw-semibold small">Pending</h6>
            <h2 className="mb-0 fw-bold">{stats.pending}</h2>
            <small className="text-warning fw-semibold">
              <FaClock className="me-1 text-warning" /> {stats.total > 0 ? ((stats.pending / stats.total) * 100).toFixed(1) : 0}% dari total
            </small>
          </div>
          <div className="icon-shape bg-gradient-warning rounded-3 stat-icon">
            <FaClock className="text-white" style={{ fontSize: "2rem" }} />
          </div>
        </div>
        <div className="progress mt-3" style={{ height: '4px' }}>
          <div 
            className="progress-bar bg-gradient-warning" 
            role="progressbar" 
            style={{ width: `${stats.total > 0 ? (stats.pending / stats.total) * 100 : 0}%` }} 
            aria-valuenow={stats.pending} 
            aria-valuemin="0" 
            aria-valuemax={stats.total}
          ></div>
        </div>
      </Card.Body>
    </Card>
  </Col>
  <Col xl={3} lg={6} md={6} sm={12}>
    <Card className="stat-card-ultra border-0 h-100 overflow-hidden">
      <Card.Body className="p-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h6 className="text-uppercase text-muted mb-2 fw-semibold small">Selesai</h6>
            <h2 className="mb-0 fw-bold">{stats.completed}</h2>
            <small className="text-success fw-semibold">
              <FaCheckCircle className="me-1 text-success" /> {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}% sukses
            </small>
          </div>
          <div className="icon-shape bg-gradient-success rounded-3 stat-icon">
            <FaCheckCircle className="text-white" style={{ fontSize: "2rem" }} />
          </div>
        </div>
        <div className="progress mt-3" style={{ height: '4px' }}>
          <div 
            className="progress-bar bg-gradient-success" 
            role="progressbar" 
            style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }} 
            aria-valuenow={stats.completed} 
            aria-valuemin="0" 
            aria-valuemax={stats.total}
          ></div>
        </div>
      </Card.Body>
    </Card>
  </Col>
  <Col xl={3} lg={6} md={6} sm={12}>
    <Card className="stat-card-ultra border-0 h-100 overflow-hidden">
      <Card.Body className="p-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h6 className="text-uppercase text-muted mb-2 fw-semibold small">Dibatalkan</h6>
            <h2 className="mb-0 fw-bold">{stats.cancelled}</h2>
            <small className="text-danger fw-semibold">
              <FaTimesCircle className="me-1 text-danger" /> {stats.total > 0 ? ((stats.cancelled / stats.total) * 100).toFixed(1) : 0}% gagal
            </small>
          </div>
          <div className="icon-shape bg-gradient-danger rounded-3 stat-icon">
            <FaTimesCircle className="text-white" style={{ fontSize: "2rem" }} />
          </div>
        </div>
        <div className="progress mt-3" style={{ height: '4px' }}>
          <div 
            className="progress-bar bg-gradient-danger" 
            role="progressbar" 
            style={{ width: `${stats.total > 0 ? (stats.cancelled / stats.total) * 100 : 0}%` }} 
            aria-valuenow={stats.cancelled} 
            aria-valuemin="0" 
            aria-valuemax={stats.total}
          ></div>
        </div>
      </Card.Body>
    </Card>
  </Col>
</Row>

      {/* Status Distribution */}
      <Card className="mb-4 shadow-sm border-0">
        <Card.Body>
          <h5 className="card-title mb-3">Distribusi Status Pesanan</h5>
          <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
            {statusDistribution.map((item, index) => (
              <div key={index} className="d-flex align-items-center gap-2">
                <span
                  className={`icon-status-distribution bg-${item.color}-soft`}
                  style={{
                    background: `var(--bs-${item.color}-bg-subtle, #f8f9fa)`,
                    color: `var(--bs-${item.color}, #6c757d)`,
                  }}
                >
                  {item.icon}
                </span>
                <span className="fw-semibold">{item.label}</span>
                <span className={`badge rounded-pill bg-${item.color} ms-1`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
          <ProgressBar className="mb-2" style={{ height: 14, background: "#e9ecef" }}>
            {statusDistribution.map((item, index) => (
              <ProgressBar
                key={index}
                variant={item.color}
                now={stats.total ? (item.count / stats.total) * 100 : 0}
                style={{
                  fontWeight: 600,
                  fontSize: 12,
                  background: `var(--bs-${item.color}-bg-subtle, #f8f9fa)`,
                }}
              />
            ))}
          </ProgressBar>
          <div className="small text-muted">
            Total pesanan: <span className="fw-bold">{stats.total}</span>
          </div>
        </Card.Body>
      </Card>

      {/* Filter */}
      <Card className="mb-4 shadow-sm border-0 sticky-top" style={{zIndex: 10, top: 0}}>
        <Card.Body>
          <Row className="g-2 align-items-center">
            <Col md={3}>
              <InputGroup>
                <InputGroup.Text><FaSearch /></InputGroup.Text>
                <Form.Control
                  placeholder="Cari pelanggan, mobil, atau ID..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </InputGroup>
            </Col>
            <Col md={2}>
              <Form.Select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                <option value="all">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Select value={filterCar} onChange={e => { setFilterCar(e.target.value); setPage(1); }}>
                <option value="all">Semua Mobil</option>
                {cars.map(car => (
                  <option key={car.id} value={car.id}>{car.nama}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Select value={filterPayment} onChange={e => { setFilterPayment(e.target.value); setPage(1); }}>
                <option value="all">Semua Pembayaran</option>
                <option value="credit_card">Credit Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="e_wallet">E-Wallet</option>
              </Form.Select>
            </Col>
            <Col md={1}>
              <Form.Control type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
            </Col>
            <Col md={1}>
              <Form.Control type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
            </Col>
            <Col md={1}>
              <Form.Select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt} / halaman</option>
                ))}
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Status Tabs */}
      <div className="status-tabs-bg rounded mb-4 px-2 py-2">
        <Nav variant="pills" activeKey={activeTab} onSelect={setActiveTab} className="custom-status-tabs">
          <Nav.Item>
            <Nav.Link 
              eventKey="all" 
              className="d-flex align-items-center"
            >
              <FaClipboardList className="me-2 text-primary" />
              Semua
              <Badge pill bg="secondary" className="ms-2">
                {orders.length}
              </Badge>
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link 
              eventKey="pending" 
              className="d-flex align-items-center"
            >
              <FaClock className="me-2 text-warning" />
              Pending
              <Badge pill bg="warning" className="ms-2">
                {stats.pending}
              </Badge>
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link 
              eventKey="confirmed" 
              className="d-flex align-items-center"
            >
              <FaClipboardCheck className="me-2 text-info" />
              Dikonfirmasi
              <Badge pill bg="primary" className="ms-2">
                {stats.confirmed}
              </Badge>
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link 
              eventKey="completed" 
              className="d-flex align-items-center"
            >
              <FaCheckCircle className="me-2 text-success" />
              Selesai
              <Badge pill bg="success" className="ms-2">
                {stats.completed}
              </Badge>
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link 
              eventKey="cancelled" 
              className="d-flex align-items-center"
            >
              <FaTimesCircle className="me-2 text-danger" />
              Dibatalkan
              <Badge pill bg="danger" className="ms-2">
                {stats.cancelled}
              </Badge>
            </Nav.Link>
          </Nav.Item>
        </Nav>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className={`align-middle mb-0 ${darkMode ? "table-dark" : ""}`} style={{ minWidth: 1100 }}>
              <thead className={darkMode ? "bg-dark" : "bg-light"}>
                <tr>
                  <th>
                    <Form.Check
                      type="checkbox"
                      checked={selectedIds.length === filteredByTab.length && filteredByTab.length > 0}
                      onChange={e => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("id")}>
                    ID {getSortIcon("id")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("user")}>
                    Pelanggan {getSortIcon("user")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("layanan")}>
                    Mobil {getSortIcon("layanan")}
                  </th>
                  <th>Tanggal Sewa</th>
                  <th>Durasi</th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("total_price")}>
                    Total {getSortIcon("total_price")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("status")}>
                    Status {getSortIcon("status")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("payment_status")}>
                    Pembayaran {getSortIcon("payment_status")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("createdAt")}>
                    Dibuat {getSortIcon("createdAt")}
                  </th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="11" className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                    </td>
                  </tr>
                ) : filteredByTab.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center py-5">
                      <div className="text-muted">Tidak ada data pesanan</div>
                    </td>
                  </tr>
                ) : (
                  filteredByTab.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={selectedIds.includes(order.id)}
                          onChange={() => handleSelectOne(order.id)}
                        />
                      </td>
                      <td>
                        <Badge bg="secondary" className="fw-bold rounded-pill px-3 py-2">
                          #{order.id}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <FaUserCircle className="text-primary fs-5 me-2" />
                          <span className="fw-semibold">{order.user?.name || "-"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <FaCarSide className="text-info fs-5 me-2" />
                          {order.layanan?.nama || "-"}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <FaCalendarAlt className="text-success fs-5 me-2" />
                          <div>
                            <div>{formatDate(order.pickup_date)}</div>
                            <div className="text-muted small">sampai</div>
                            <div>{formatDate(order.return_date)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {order.pickup_date && order.return_date
                          ? moment(order.return_date).diff(
                              moment(order.pickup_date),
                              "days"
                            ) + " hari"
                          : "-"}
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <FaMoneyBillWave className="text-success fs-5 me-2" />
                          <span className="fw-bold text-success">
                            {formatCurrency(order.total_price)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge pill bg={getStatusBadge(order.status)} className="px-3 py-2">
                          {formatStatus(order.status) || "-"}
                        </Badge>
                      </td>
                      <td>
                        <Badge
                          pill
                          bg={getPaymentBadge(order.payment_status)}
                          className="px-3 py-2"
                        >
                          {formatPaymentStatus(order.payment_status)}
                        </Badge>
                        <div className="small mt-1">
                          {paymentIcon(order.payment_method)}
                          <span className="align-middle">{order.payment_method?.replace("_", " ") || "-"}</span>
                        </div>
                      </td>
                      <td>
                        {formatDateTime(order.createdAt || order.created_at)}
                      </td>
                      <td>
                        <Dropdown>
                          <Dropdown.Toggle
                            variant={darkMode ? "secondary" : "light"}
                            size="sm"
                            id="dropdown-actions"
                            style={{ border: "none" }}
                          >
                            <FaEllipsisV />
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Item onClick={() => handleShowDetail(order)}>
                              <FaEye className="me-2 text-primary" /> Detail
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => { setShowStatusModal(true); setSelectedOrder(order); }}>
                              <FaEdit className="me-2 text-warning" /> Edit Status
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => { setShowPaymentStatusModal(true); setSelectedOrder(order); }}>
                              <FaEdit className="me-2 text-info" /> Edit Pembayaran
                            </Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item
                              className="text-danger"
                              onClick={() => { setShowDeleteModal(true); setDeleteIds([order.id]); }}
                            >
                              <FaTrashAlt className="me-2" /> Batalkan
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => handlePrintInvoice(order)}>
                              <FaPrint className="me-2 text-secondary" /> Cetak Invoice
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Pagination */}
      <Row className="align-items-center">
        <Col>
          <div className="text-muted">
            Menampilkan {filteredByTab.length} dari {sortedOrders.length} pesanan
          </div>
        </Col>
        <Col xs="auto">
          <Button
            variant="outline-primary"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="me-2"
          >
            Sebelumnya
          </Button>
          <span className="mx-2">
            Halaman {page} dari {totalPages}
          </span>
          <Button
            variant="outline-primary"
            size="sm"
            disabled={page === totalPages || totalPages === 0}
            onClick={() => setPage((p) => p + 1)}
            className="ms-2"
          >
            Selanjutnya
          </Button>
        </Col>
      </Row>

      {/* Toast Notification */}
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast
          show={toast.show}
          onClose={() => setToast({ ...toast, show: false })}
          bg={toast.variant}
          delay={2500}
          autohide
        >
          <Toast.Body className="text-white">{toast.message}</Toast.Body>
        </Toast>
      </ToastContainer>

      {/* Modal Detail */}
      <Modal show={showDetail} onHide={() => setShowDetail(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Detail Pesanan #{selectedOrder?.id}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailLoading ? (
            <div className="text-center py-4">
              <Spinner />
            </div>
          ) : selectedOrder ? (
            <Tab.Container defaultActiveKey="info">
              <Nav variant="tabs" className="mb-3">
                <Nav.Item>
                  <Nav.Link eventKey="info">Informasi Pesanan</Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="payment">Pembayaran</Nav.Link>
                </Nav.Item>
              </Nav>
              <Tab.Content>
                <Tab.Pane eventKey="info">
                  <Row>
                    <Col md={6}>
                      <Card className="mb-3 border-0 shadow-sm">
                        <Card.Body>
                          <h6 className="mb-3 fw-bold">Detail Pelanggan</h6>
                          <div className="mb-2">
                            <small className="text-muted">Nama</small>
                            <div>{selectedOrder.user?.name || '-'}</div>
                          </div>
                          <div className="mb-2">
                            <small className="text-muted">Email</small>
                            <div>{selectedOrder.user?.email || '-'}</div>
                          </div>
                          <div className="mb-2">
                            <small className="text-muted">Telepon</small>
                            <div>{selectedOrder.user?.phone || '-'}</div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={6}>
                      <Card className="mb-3 border-0 shadow-sm">
                        <Card.Body>
                          <h6 className="mb-3 fw-bold">Detail Kendaraan</h6>
                          <div className="mb-2">
                            <small className="text-muted">Mobil</small>
                            <div>{selectedOrder.layanan?.nama || '-'}</div>
                          </div>
                          <div className="mb-2">
                            <small className="text-muted">Harga/Hari</small>
                            <div>{formatCurrency(selectedOrder.layanan?.harga)}</div>
                          </div>
                          <div className="mb-2">
                            <small className="text-muted">Tanggal Sewa</small>
                            <div>
                              {formatDate(selectedOrder.pickup_date)} - {formatDate(selectedOrder.return_date)}
                            </div>
                          </div>
                          <div className="mb-2">
                            <small className="text-muted">Durasi</small>
                            <div>
                              {selectedOrder.pickup_date && selectedOrder.return_date
                                ? moment(selectedOrder.return_date).diff(
                                    moment(selectedOrder.pickup_date),
                                    "days"
                                  ) + " hari"
                                : "-"}
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={12}>
                      <Card className="border-0 shadow-sm">
                        <Card.Body>
                          <h6 className="mb-3 fw-bold">Catatan Tambahan</h6>
                          <div className="bg-light p-3 rounded">
                            {selectedOrder.additional_notes || 'Tidak ada catatan'}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </Tab.Pane>
                <Tab.Pane eventKey="payment">
                  <Row>
                    <Col md={6}>
                      <Card className="mb-3 border-0 shadow-sm">
                        <Card.Body>
                          <h6 className="mb-3 fw-bold">Ringkasan Pembayaran</h6>
                          <div className="mb-2">
                            <small className="text-muted">Total</small>
                            <div className="fw-bold text-success fs-5">
                              {formatCurrency(selectedOrder.total_price)}
                            </div>
                          </div>
                          <div className="mb-2">
                            <small className="text-muted">Status Pembayaran</small>
                            <div>
                              <Badge 
                                bg={getPaymentBadge(selectedOrder.payment_status)} 
                                className="px-3 py-2"
                              >
                                {formatPaymentStatus(selectedOrder.payment_status)}
                              </Badge>
                            </div>
                          </div>
                          <div className="mb-2">
                            <small className="text-muted">Metode Pembayaran</small>
                            <div>{selectedOrder.payment_method || '-'}</div>
                          </div>
                          <div className="mb-2">
                            <small className="text-muted">Tanggal Pembayaran</small>
                            <div>{formatDateTime(selectedOrder.payment_date)}</div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={6}>
                      <Card className="mb-3 border-0 shadow-sm">
                        <Card.Body>
                          <h6 className="mb-3 fw-bold">Bukti Pembayaran</h6>
                          {selectedOrder.payment_proof ? (
                            <div className="text-center">
                              <a 
                                href={
                                  selectedOrder.payment_proof.startsWith("http")
                                    ? selectedOrder.payment_proof
                                    : `${getBaseUrl()}${selectedOrder.payment_proof}`
                                }
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <img
                                  src={
                                    selectedOrder.payment_proof.startsWith("http")
                                      ? selectedOrder.payment_proof
                                      : `${getBaseUrl()}${selectedOrder.payment_proof}`
                                  }
                                  alt="Bukti Pembayaran"
                                  className="img-fluid rounded border"
                                  style={{ maxHeight: 200 }}
                                  onError={e => { e.target.onerror = null; e.target.src = "/no-image.png"; }}
                                />
                              </a>
                              <div className="mt-2">
                                <Button 
                                  variant="primary" 
                                  size="sm"
                                  onClick={() => window.open(
                                    selectedOrder.payment_proof.startsWith("http")
                                      ? selectedOrder.payment_proof
                                      : `${getBaseUrl()}${selectedOrder.payment_proof}`,
                                    '_blank'
                                  )}
                                >
                                  Lihat Full Size
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center text-muted py-4">
                              Tidak ada bukti pembayaran
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </Tab.Pane>
              </Tab.Content>
            </Tab.Container>
          ) : (
            <Spinner />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetail(false)}>
            Tutup
          </Button>
          <Button 
            variant="primary" 
            onClick={() => {
              setShowDetail(false);
              handlePrintInvoice(selectedOrder);
            }}
          >
            Cetak Invoice
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Status Modal */}
      <Modal show={showStatusModal} onHide={() => setShowStatusModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit Status Pesanan</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={statusToEdit}
                onChange={(e) => setStatusToEdit(e.target.value)}
              >
                <option value="">-- Pilih Status --</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowStatusModal(false)}>
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!statusToEdit) return;
              try {
                await axios.put(
                  `${API_URL}/orders/${selectedOrder.id}`,
                  { status: statusToEdit },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                showToast("Status pesanan berhasil diupdate!");
                setShowStatusModal(false);
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === selectedOrder.id ? { ...o, status: statusToEdit } : o
                  )
                );
              } catch {
                showToast("Gagal update status!", "danger");
              }
            }}
            disabled={!statusToEdit}
          >
            Simpan
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Payment Status Modal */}
      <Modal show={showPaymentStatusModal} onHide={() => setShowPaymentStatusModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit Status Pembayaran</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Status Pembayaran</Form.Label>
              <Form.Select
                value={paymentStatusToEdit}
                onChange={(e) => setPaymentStatusToEdit(e.target.value)}
              >
                <option value="">-- Pilih Status Pembayaran --</option>
                <option value="paid">Lunas</option>
                <option value="rejected">Ditolak</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPaymentStatusModal(false)}>
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!paymentStatusToEdit) return;
              try {
                await axios.put(
                  `${API_URL}/orders/${selectedOrder.id}/verify`,
                  { status: paymentStatusToEdit },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                showToast("Status pembayaran berhasil diupdate!");
                setShowPaymentStatusModal(false);
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === selectedOrder.id ? { ...o, payment_status: paymentStatusToEdit } : o
                  )
                );
              } catch {
                showToast("Gagal update status pembayaran!", "danger");
              }
            }}
            disabled={!paymentStatusToEdit}
          >
            Simpan
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Konfirmasi Hapus</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Apakah Anda yakin ingin membatalkan pesanan ini? Aksi ini tidak dapat dibatalkan.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await axios.delete(`${API_URL}/orders/${deleteIds[0]}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                setOrders((orders) => orders.filter((o) => o.id !== deleteIds[0]));
                setShowDeleteModal(false);
                setSelectedIds(selectedIds.filter(id => id !== deleteIds[0]));
                showToast("Pesanan berhasil dibatalkan!");
              } catch {
                showToast("Gagal membatalkan pesanan!", "danger");
              }
            }}
          >
            Batalkan Pesanan
          </Button>
        </Modal.Footer>
      </Modal>

      <style>
      {`
        .stat-card-modern {
          background: #f8fafd;
          border-radius: 1rem;
          transition: box-shadow 0.2s, transform 0.2s;
          box-shadow: 0 2px 8px rgba(78,115,223,0.06);
        }
        .stat-card-modern:hover {
          box-shadow: 0 6px 24px rgba(78,115,223,0.13);
          transform: translateY(-2px) scale(1.02);
        }
        .stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          font-size: 2rem;
        }
        .bg-gradient-primary {
          background: linear-gradient(135deg, #4e73df 0%, #224abe 100%);
        }
        .bg-gradient-warning {
          background: linear-gradient(135deg, #f6c23e 0%, #dda20a 100%);
        }
        .bg-gradient-success {
          background: linear-gradient(135deg, #1cc88a 0%, #13855c 100%);
        }
        .bg-gradient-danger {
          background: linear-gradient(135deg, #e74a3b 0%, #be2617 100%);
        }
        .icon-circle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .bg-gradient-primary {
          background: linear-gradient(135deg, #4e73df 0%, #224abe 100%);
        }
        .bg-gradient-warning {
          background: linear-gradient(135deg, #f6c23e 0%, #dda20a 100%);
        }
        .bg-gradient-success {
          background: linear-gradient(135deg, #1cc88a 0%, #13855c 100%);
        }
        .bg-gradient-danger {
          background: linear-gradient(135deg, #e74a3b 0%, #be2617 100%);
        }
        .stat-card {
          transition: box-shadow 0.2s;
        }
        .stat-card:hover {
          box-shadow: 0 4px 24px rgba(78,115,223,0.12);
        }
        .status-tabs-bg {
          background: #f4f6fa;
          /* Ganti warna sesuai selera, misal #f8f9fa, #f4f6fa, dsb */
          border-radius: 0.75rem;
        }
        .custom-status-tabs .nav-link {
          color: #495057 !important;
          font-weight: 500;
          border-radius: 0.5rem !important;
          margin-right: 4px;
          transition: background 0.2s, color 0.2s;
        }
        .custom-status-tabs .nav-link.active {
          background: #e9ecef !important;
          color: #212529 !important;
          font-weight: bold;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .icon-status-distribution {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 1.25rem;
          background: #f8f9fa;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .bg-success-soft { background: #e6f4ea !important; color: #198754 !important; }
        .bg-info-soft { background: #e7f3fa !important; color: #0dcaf0 !important; }
        .bg-warning-soft { background: #fff8e1 !important; color: #ffc107 !important; }
        .bg-danger-soft { background: #fdeaea !important; color: #dc3545 !important; }
         .stat-card-ultra {
    background: #ffffff;
    border-radius: 12px;
    transition: all 0.3s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.03);
    border: 1px solid rgba(0, 0, 0, 0.04);
    position: relative;
    overflow: hidden;
  }
  
  .stat-card-ultra:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08);
  }
  
  .stat-card-ultra::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, rgba(78,115,223,0.1) 0%, rgba(78,115,223,0.3) 100%);
  }
  
  .stat-card-ultra:nth-child(1)::before {
    background: linear-gradient(90deg, rgba(78,115,223,0.1) 0%, rgba(78,115,223,0.8) 100%);
  }
  
  .stat-card-ultra:nth-child(2)::before {
    background: linear-gradient(90deg, rgba(255,193,7,0.1) 0%, rgba(255,193,7,0.8) 100%);
  }
  
  .stat-card-ultra:nth-child(3)::before {
    background: linear-gradient(90deg, rgba(28,200,138,0.1) 0%, rgba(28,200,138,0.8) 100%);
  }
  
  .stat-card-ultra:nth-child(4)::before {
    background: linear-gradient(90deg, rgba(231,74,59,0.1) 0%, rgba(231,74,59,0.8) 100%);
  }
  
  .icon-shape {
    width: 54px;
    height: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }
  
  .stat-card-ultra:hover .icon-shape {
    transform: scale(1.1);
  }
  
  @media (max-width: 768px) {
    .stat-card-ultra {
      margin-bottom: 16px;
    }
  }
      `}
      </style>
    </Container>
  );
};

export default OrdersPage;