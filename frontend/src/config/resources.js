// Config-driven CRUD resource definitions.
// select options tokens: "$stages", "$sources", "$services" resolve from org.

export const RESOURCE_CONFIGS = {
  leads: {
    resource: "leads", title: "Leads", subtitle: "Capture and qualify every prospect",
    columns: [
      { key: "name", label: "Name", primary: true },
      { key: "email", label: "Email" },
      { key: "company", label: "Company" },
      { key: "source", label: "Source", type: "badge" },
      { key: "status", label: "Status", type: "badge" },
      { key: "score", label: "Score", type: "score" },
      { key: "budget", label: "Budget", type: "money" },
    ],
    fields: [
      { name: "name", label: "Full name", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone" },
      { name: "company", label: "Company" },
      { name: "website", label: "Website" },
      { name: "location", label: "Location" },
      { name: "source", label: "Lead source", type: "select", options: "$sources" },
      { name: "service", label: "Service interest", type: "select", options: "$services" },
      { name: "budget", label: "Budget" },
      { name: "score", label: "Lead score", type: "number" },
      { name: "status", label: "Status", type: "select", options: "$stages" },
      { name: "follow_up_date", label: "Follow-up date", type: "date" },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },
  contacts: {
    resource: "contacts", title: "Contacts", subtitle: "People you do business with",
    columns: [
      { key: "name", label: "Name", primary: true }, { key: "email", label: "Email" },
      { key: "phone", label: "Phone" }, { key: "company", label: "Company" }, { key: "title", label: "Title" },
    ],
    fields: [
      { name: "name", label: "Full name", required: true }, { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone" }, { name: "company", label: "Company" }, { name: "title", label: "Job title" },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },
  companies: {
    resource: "companies", title: "Companies", subtitle: "Organizations in your network",
    columns: [
      { key: "name", label: "Name", primary: true }, { key: "website", label: "Website" },
      { key: "industry", label: "Industry" }, { key: "size", label: "Size" }, { key: "location", label: "Location" },
    ],
    fields: [
      { name: "name", label: "Company name", required: true }, { name: "website", label: "Website" },
      { name: "industry", label: "Industry" }, { name: "size", label: "Company size" }, { name: "location", label: "Location" },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },
  deals: {
    resource: "deals", title: "Deals", subtitle: "Every opportunity in your pipeline",
    columns: [
      { key: "title", label: "Deal", primary: true }, { key: "company", label: "Company" },
      { key: "value", label: "Value", type: "money" }, { key: "stage", label: "Stage", type: "badge" },
      { key: "expected_close", label: "Close date" },
    ],
    fields: [
      { name: "title", label: "Deal title", required: true }, { name: "company", label: "Company" },
      { name: "email", label: "Contact email", type: "email" }, { name: "value", label: "Deal value", type: "number" },
      { name: "stage", label: "Stage", type: "select", options: "$stages" }, { name: "expected_close", label: "Expected close", type: "date" },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },
  clients: {
    resource: "clients", title: "Clients", subtitle: "Active customer accounts",
    columns: [
      { key: "name", label: "Client", primary: true }, { key: "company", label: "Company" },
      { key: "email", label: "Email" }, { key: "status", label: "Status", type: "badge" }, { key: "value", label: "Value", type: "money" },
    ],
    fields: [
      { name: "name", label: "Client name", required: true }, { name: "company", label: "Company" },
      { name: "email", label: "Email", type: "email" }, { name: "value", label: "Account value", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["active", "inactive"] },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },
  tasks: {
    resource: "tasks", title: "Tasks", subtitle: "Stay on top of your to-dos",
    columns: [
      { key: "title", label: "Task", primary: true }, { key: "priority", label: "Priority", type: "badge" },
      { key: "status", label: "Status", type: "badge" }, { key: "due_date", label: "Due" },
    ],
    fields: [
      { name: "title", label: "Task", required: true }, { name: "description", label: "Description", type: "textarea", full: true },
      { name: "priority", label: "Priority", type: "select", options: ["high", "medium", "low"] },
      { name: "status", label: "Status", type: "select", options: ["todo", "in_progress", "done"] },
      { name: "due_date", label: "Due date", type: "date" },
    ],
  },
  proposals: {
    resource: "proposals", title: "Proposals", subtitle: "Quotes and proposals",
    columns: [
      { key: "title", label: "Title", primary: true }, { key: "type", label: "Type" },
      { key: "amount", label: "Amount", type: "money" }, { key: "status", label: "Status", type: "badge" },
    ],
    fields: [
      { name: "title", label: "Title", required: true }, { name: "type", label: "Type", type: "select", options: ["proposal", "quote"] },
      { name: "amount", label: "Amount", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Viewed", "Accepted", "Rejected", "Expired"] },
      { name: "content", label: "Content", type: "textarea", full: true },
    ],
  },
  contracts: {
    resource: "contracts", title: "Contracts", subtitle: "Agreements and signatures",
    columns: [
      { key: "title", label: "Title", primary: true }, { key: "amount", label: "Amount", type: "money" }, { key: "status", label: "Status", type: "badge" },
    ],
    fields: [
      { name: "title", label: "Title", required: true }, { name: "amount", label: "Amount", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Viewed", "Accepted", "Rejected", "Expired"] },
      { name: "content", label: "Content", type: "textarea", full: true },
    ],
  },
  invoices: {
    resource: "invoices", title: "Invoices", subtitle: "Bill clients and track payments",
    columns: [
      { key: "number", label: "Invoice", primary: true }, { key: "total", label: "Total", type: "money" },
      { key: "paid_amount", label: "Paid", type: "money" }, { key: "pending_amount", label: "Pending", type: "money" },
      { key: "status", label: "Status", type: "badge" }, { key: "due_date", label: "Due" },
    ],
    fields: [
      { name: "number", label: "Invoice number", required: true }, { name: "amount", label: "Amount (subtotal)", type: "number" },
      { name: "tax", label: "Tax", type: "number" }, { name: "discount", label: "Discount", type: "number" },
      { name: "paid_amount", label: "Paid amount", type: "number" }, { name: "due_date", label: "Due date", type: "date" },
    ],
  },
  payments: {
    resource: "payments", title: "Payments", subtitle: "Recorded payments",
    columns: [
      { key: "invoice_id", label: "Invoice" }, { key: "amount", label: "Amount", type: "money" },
      { key: "method", label: "Method" }, { key: "status", label: "Status", type: "badge" }, { key: "date", label: "Date" },
    ],
    fields: [
      { name: "invoice_id", label: "Invoice ID" }, { name: "amount", label: "Amount", type: "number", required: true },
      { name: "method", label: "Method", type: "select", options: ["Bank Transfer", "Card", "Cash", "Stripe", "PayPal"] },
      { name: "status", label: "Status", type: "select", options: ["completed", "pending"] }, { name: "date", label: "Date", type: "date" },
    ],
  },
  campaigns: {
    resource: "campaigns", title: "Campaigns", subtitle: "Marketing campaigns & performance",
    columns: [
      { key: "name", label: "Campaign", primary: true }, { key: "channel", label: "Channel" },
      { key: "status", label: "Status", type: "badge" }, { key: "budget", label: "Budget", type: "money" },
      { key: "spent", label: "Spent", type: "money" }, { key: "revenue", label: "Revenue", type: "money" },
    ],
    fields: [
      { name: "name", label: "Campaign name", required: true },
      { name: "channel", label: "Channel", type: "select", options: ["Google Ads", "Meta Ads", "Social Media", "Email", "SEO"] },
      { name: "status", label: "Status", type: "select", options: ["active", "paused", "completed"] },
      { name: "budget", label: "Budget", type: "number" }, { name: "spent", label: "Spent", type: "number" },
      { name: "leads", label: "Leads", type: "number" }, { name: "revenue", label: "Revenue", type: "number" },
    ],
  },
  content: {
    resource: "content", title: "Content", subtitle: "Content calendar & assets",
    columns: [
      { key: "title", label: "Title", primary: true }, { key: "type", label: "Type" },
      { key: "status", label: "Status", type: "badge" }, { key: "publish_date", label: "Publish" },
    ],
    fields: [
      { name: "title", label: "Title", required: true }, { name: "type", label: "Type", type: "select", options: ["Blog", "Social", "Email", "Video", "Ad"] },
      { name: "status", label: "Status", type: "select", options: ["Draft", "Scheduled", "Published"] },
      { name: "publish_date", label: "Publish date", type: "date" }, { name: "body", label: "Body", type: "textarea", full: true },
    ],
  },
  messages: {
    resource: "messages", title: "Messages", subtitle: "Communication history",
    columns: [
      { key: "subject", label: "Subject", primary: true }, { key: "channel", label: "Channel" },
      { key: "direction", label: "Direction" }, { key: "to", label: "To" },
    ],
    fields: [
      { name: "subject", label: "Subject", required: true }, { name: "to", label: "To" },
      { name: "channel", label: "Channel", type: "select", options: ["email", "whatsapp", "slack", "sms"] },
      { name: "direction", label: "Direction", type: "select", options: ["outbound", "inbound"] },
      { name: "body", label: "Message", type: "textarea", full: true },
    ],
  },
  email: {
    resource: "messages", title: "Email", subtitle: "Send and log emails", defaults: { channel: "email", direction: "outbound" },
    columns: [
      { key: "subject", label: "Subject", primary: true }, { key: "to", label: "To" }, { key: "direction", label: "Direction" },
    ],
    fields: [
      { name: "subject", label: "Subject", required: true }, { name: "to", label: "To (email)", type: "email" },
      { name: "body", label: "Body", type: "textarea", full: true },
      { name: "direction", label: "Direction", type: "select", options: ["outbound", "inbound"] },
    ],
  },
  calendar: {
    resource: "events", title: "Calendar", subtitle: "Meetings and events",
    columns: [
      { key: "title", label: "Event", primary: true }, { key: "start", label: "Start" }, { key: "end", label: "End" }, { key: "type", label: "Type" },
    ],
    fields: [
      { name: "title", label: "Event title", required: true }, { name: "start", label: "Start", type: "date" },
      { name: "end", label: "End", type: "date" }, { name: "type", label: "Type", type: "select", options: ["Meeting", "Call", "Reminder", "Deadline"] },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },
  "website-leads": {
    resource: "leads", title: "Website Leads", subtitle: "Enquiries captured from your website", fixedFilter: { source: "Website" }, hideCreate: true,
    columns: [
      { key: "name", label: "Name", primary: true }, { key: "email", label: "Email" },
      { key: "company", label: "Company" }, { key: "service", label: "Service" }, { key: "status", label: "Status", type: "badge" },
    ],
    fields: [
      { name: "name", label: "Name" }, { name: "email", label: "Email", type: "email" },
      { name: "status", label: "Status", type: "select", options: "$stages" },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },
};
