import { bindLogoutButtons, getDisplayUsername, populateAuthUI, requireAuth } from "./session.js";
import { requireSupabaseClient } from "./supabase.js";

const state = {
  auth: null,
  profileName: "player",
  tickets: [],
  messagesByTicketId: new Map(),
  selectedTicketId: null,
  channel: null
};

const nodes = {
  createForm: document.getElementById("tickets-create-form"),
  createFeedback: document.getElementById("tickets-create-feedback"),
  list: document.getElementById("tickets-list"),
  refreshButton: document.getElementById("tickets-refresh-button"),
  threadEmpty: document.getElementById("tickets-thread-empty"),
  threadBody: document.getElementById("tickets-thread-body"),
  threadMeta: document.getElementById("tickets-thread-meta"),
  threadTitle: document.getElementById("tickets-thread-title"),
  threadSubline: document.getElementById("tickets-thread-subline"),
  threadStatus: document.getElementById("tickets-thread-status"),
  reopenButton: document.getElementById("tickets-reopen-button"),
  threadMessages: document.getElementById("tickets-thread-messages"),
  replyForm: document.getElementById("tickets-reply-form"),
  replyInput: document.getElementById("tickets-reply-input"),
  replySubmit: document.getElementById("tickets-reply-submit"),
  replyFeedback: document.getElementById("tickets-reply-feedback"),
  openCount: document.getElementById("tickets-open-count"),
  answeredCount: document.getElementById("tickets-answered-count"),
  closedCount: document.getElementById("tickets-closed-count")
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "unknown time";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatRelative(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "just now";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return diffMinutes + "m ago";
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours + "h ago";
  }

  return Math.floor(diffHours / 24) + "d ago";
}

function ticketLabel(ticket) {
  const number = Number(ticket.ticket_number || 0);
  return number > 0 ? "#" + String(number).padStart(4, "0") : "Ticket";
}

function getTicketUsername(ticket) {
  return String(
    ticket?.user?.username ||
    ticket?.requester?.username ||
    state.profileName ||
    "player"
  ).trim() || "player";
}

function setFeedback(node, message, type) {
  if (!node) {
    return;
  }

  node.textContent = message || "";
  node.classList.remove("is-error", "is-success");
  if (type) {
    node.classList.add(type === "error" ? "is-error" : "is-success");
  }
}

function updateCounters() {
  const counts = state.tickets.reduce(function (acc, ticket) {
    const status = String(ticket.status || "").toLowerCase();
    if (status === "closed") {
      acc.closed += 1;
    } else if (status === "answered") {
      acc.answered += 1;
    } else {
      acc.open += 1;
    }

    return acc;
  }, { open: 0, answered: 0, closed: 0 });

  if (nodes.openCount) {
    nodes.openCount.textContent = String(counts.open);
  }
  if (nodes.answeredCount) {
    nodes.answeredCount.textContent = String(counts.answered);
  }
  if (nodes.closedCount) {
    nodes.closedCount.textContent = String(counts.closed);
  }
}

function renderTicketList() {
  if (!nodes.list) {
    return;
  }

  if (state.tickets.length === 0) {
    nodes.list.innerHTML = '<div class="tickets-empty">No tickets yet. Create one to start a support thread.</div>';
    return;
  }

  nodes.list.innerHTML = state.tickets.map(function (ticket) {
    const activeClass = ticket.id === state.selectedTicketId ? " is-active" : "";
    const messageCount = Number(ticket.message_count || 0);
    return `
      <button type="button" class="tickets-ticket${activeClass}" data-ticket-id="${escapeHtml(ticket.id)}">
        <div class="tickets-ticket__top">
          <h3 class="tickets-ticket__subject">${escapeHtml(ticket.subject)}</h3>
          <span class="tickets-status-badge" data-status="${escapeHtml(String(ticket.status || "").toLowerCase())}">${escapeHtml(ticket.status || "OPEN")}</span>
        </div>
        <p class="tickets-ticket__snippet">${escapeHtml(ticketLabel(ticket))} · ${escapeHtml(ticket.category || "GENERAL")} · ${messageCount} message${messageCount === 1 ? "" : "s"}</p>
        <div class="tickets-ticket__meta">
          <span class="tickets-ticket__chips">
            <span class="tickets-priority-badge" data-priority="${escapeHtml(String(ticket.priority || "").toLowerCase())}">${escapeHtml(ticket.priority || "NORMAL")}</span>
            <span class="tickets-category-badge">${escapeHtml(ticket.category || "GENERAL")}</span>
          </span>
          <span>${escapeHtml(formatRelative(ticket.last_message_at || ticket.updated_at || ticket.created_at))}</span>
        </div>
      </button>
    `;
  }).join("");
}

function renderThread() {
  const ticket = state.tickets.find(function (entry) {
    return entry.id === state.selectedTicketId;
  });

  if (!ticket) {
    nodes.threadEmpty?.classList.remove("is-hidden");
    nodes.threadBody?.classList.add("is-hidden");
    return;
  }

  nodes.threadEmpty?.classList.add("is-hidden");
  nodes.threadBody?.classList.remove("is-hidden");

  if (nodes.threadMeta) {
    nodes.threadMeta.textContent = ticketLabel(ticket) + " · " + String(ticket.category || "GENERAL");
  }
  if (nodes.threadTitle) {
    nodes.threadTitle.textContent = ticket.subject || "Support ticket";
  }
  if (nodes.threadSubline) {
    nodes.threadSubline.textContent = "Raised by " + getTicketUsername(ticket) + " on " + formatDateTime(ticket.created_at);
  }
  if (nodes.threadStatus) {
    const status = String(ticket.status || "OPEN").toUpperCase();
    nodes.threadStatus.textContent = status;
    nodes.threadStatus.dataset.status = status.toLowerCase();
  }

  const messages = state.messagesByTicketId.get(ticket.id) || [];
  nodes.threadMessages.innerHTML = messages.length === 0
    ? '<div class="tickets-empty">No replies yet on this ticket.</div>'
    : messages.map(function (message) {
      const role = String(message.author_role || "user").toLowerCase();
      const bubbleClass = role === "admin" ? " tickets-message--admin" : " tickets-message--self";
      const authorName = role === "admin" ? "Admin node" : state.profileName;
      return `
        <article class="tickets-message${bubbleClass}">
          <div class="tickets-message__head">
            <span>${escapeHtml(authorName)}</span>
            <span>${escapeHtml(formatDateTime(message.created_at))}</span>
          </div>
          <p class="tickets-message__body">${escapeHtml(message.body)}</p>
        </article>
      `;
    }).join("");

  const isClosed = String(ticket.status || "").toLowerCase() === "closed";
  if (nodes.reopenButton) {
    nodes.reopenButton.classList.toggle("is-hidden", !isClosed);
    nodes.reopenButton.disabled = !isClosed;
  }
  if (nodes.replyInput) {
    nodes.replyInput.disabled = isClosed;
    nodes.replyInput.placeholder = isClosed
      ? "This ticket is closed. Reopen it to continue the thread."
      : "Add more details or respond to the admin...";
  }
  if (nodes.replySubmit) {
    nodes.replySubmit.disabled = isClosed;
  }
}

async function loadMessages(ticketId) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("support_ticket_messages")
    .select("id, ticket_id, author_id, author_role, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  state.messagesByTicketId.set(ticketId, data || []);
}

async function loadTickets(options = {}) {
  const client = requireSupabaseClient();
  const auth = state.auth;
  if (!auth?.user?.id) {
    return;
  }

  const { data, error } = await client
    .from("support_tickets")
    .select("id, ticket_number, user_id, subject, category, priority, status, created_at, updated_at, last_message_at, accepted_at, message_count, user:users!support_tickets_user_id_fkey(username)")
    .eq("user_id", auth.user.id)
    .order("last_message_at", { ascending: false });

  if (error) {
    throw error;
  }

  state.tickets = data || [];
  updateCounters();

  const requestedSelection = options.selectedTicketId;
  const hasSelectedTicket = state.tickets.some(function (ticket) {
    return ticket.id === state.selectedTicketId;
  });

  if (requestedSelection && state.tickets.some(function (ticket) { return ticket.id === requestedSelection; })) {
    state.selectedTicketId = requestedSelection;
  } else if (!hasSelectedTicket) {
    state.selectedTicketId = state.tickets[0]?.id || null;
  }

  renderTicketList();

  if (state.selectedTicketId) {
    await loadMessages(state.selectedTicketId);
  }

  renderThread();
}

async function refreshSelectedTicket() {
  if (!state.selectedTicketId) {
    await loadTickets();
    return;
  }

  await loadTickets({ selectedTicketId: state.selectedTicketId });
}

async function handleCreateTicket(event) {
  event.preventDefault();
  setFeedback(nodes.createFeedback, "");

  const form = nodes.createForm;
  if (!form) {
    return;
  }

  const formData = new FormData(form);
  const subject = String(formData.get("subject") || "").trim();
  const category = String(formData.get("category") || "GENERAL").trim().toUpperCase();
  const priority = String(formData.get("priority") || "NORMAL").trim().toUpperCase();
  const message = String(formData.get("message") || "").trim();

  if (!subject || !message) {
    setFeedback(nodes.createFeedback, "Subject and message are required.", "error");
    return;
  }

  const client = requireSupabaseClient();
  form.querySelector("button[type='submit']").disabled = true;

  try {
    const { data: ticket, error: ticketError } = await client
      .from("support_tickets")
      .insert({
        user_id: state.auth.user.id,
        subject: subject,
        category: category,
        priority: priority
      })
      .select("id, ticket_number")
      .single();

    if (ticketError) {
      throw ticketError;
    }

    const { error: messageError } = await client
      .from("support_ticket_messages")
      .insert({
        ticket_id: ticket.id,
        author_id: state.auth.user.id,
        author_role: "user",
        body: message
      });

    if (messageError) {
      throw messageError;
    }

    form.reset();
    setFeedback(nodes.createFeedback, "Ticket submitted. Admin will answer from the node panel.", "success");
    await loadTickets({ selectedTicketId: ticket.id });
  } catch (error) {
    setFeedback(nodes.createFeedback, error?.message || "Unable to submit the ticket right now.", "error");
  } finally {
    form.querySelector("button[type='submit']").disabled = false;
  }
}

async function handleReply(event) {
  event.preventDefault();
  setFeedback(nodes.replyFeedback, "");

  const ticket = state.tickets.find(function (entry) {
    return entry.id === state.selectedTicketId;
  });
  const body = String(nodes.replyInput?.value || "").trim();

  if (!ticket || !body) {
    setFeedback(nodes.replyFeedback, "Write a message before sending.", "error");
    return;
  }

  if (String(ticket.status || "").toLowerCase() === "closed") {
    setFeedback(nodes.replyFeedback, "This ticket is closed and cannot receive new replies.", "error");
    return;
  }

  const client = requireSupabaseClient();
  if (nodes.replySubmit) {
    nodes.replySubmit.disabled = true;
  }

  try {
    const { error } = await client
      .from("support_ticket_messages")
      .insert({
        ticket_id: ticket.id,
        author_id: state.auth.user.id,
        author_role: "user",
        body: body
      });

    if (error) {
      throw error;
    }

    nodes.replyInput.value = "";
    setFeedback(nodes.replyFeedback, "Reply sent.", "success");
    await refreshSelectedTicket();
  } catch (error) {
    setFeedback(nodes.replyFeedback, error?.message || "Unable to send your reply.", "error");
  } finally {
    if (nodes.replySubmit) {
      nodes.replySubmit.disabled = false;
    }
  }
}

async function handleReopenTicket() {
  setFeedback(nodes.replyFeedback, "");

  const ticket = state.tickets.find(function (entry) {
    return entry.id === state.selectedTicketId;
  });

  if (!ticket) {
    return;
  }

  if (String(ticket.status || "").toLowerCase() !== "closed") {
    return;
  }

  const client = requireSupabaseClient();
  if (nodes.reopenButton) {
    nodes.reopenButton.disabled = true;
  }

  try {
    const { error } = await client
      .from("support_tickets")
      .update({ status: "OPEN" })
      .eq("id", ticket.id)
      .eq("user_id", state.auth.user.id);

    if (error) {
      throw error;
    }

    setFeedback(nodes.replyFeedback, "Ticket reopened. You can continue the conversation now.", "success");
    await refreshSelectedTicket();
  } catch (error) {
    setFeedback(nodes.replyFeedback, error?.message || "Unable to reopen this ticket.", "error");
  } finally {
    if (nodes.reopenButton) {
      nodes.reopenButton.disabled = false;
    }
  }
}

function bindEvents() {
  nodes.createForm?.addEventListener("submit", handleCreateTicket);
  nodes.replyForm?.addEventListener("submit", handleReply);
  nodes.reopenButton?.addEventListener("click", function () {
    handleReopenTicket().catch(function (error) {
      window.alert(error?.message || "Unable to reopen this ticket.");
    });
  });

  nodes.refreshButton?.addEventListener("click", function () {
    refreshSelectedTicket().catch(function (error) {
      window.alert(error?.message || "Unable to refresh tickets right now.");
    });
  });

  nodes.list?.addEventListener("click", function (event) {
    const trigger = event.target.closest("[data-ticket-id]");
    if (!trigger) {
      return;
    }

    state.selectedTicketId = trigger.getAttribute("data-ticket-id");
    refreshSelectedTicket().catch(function (error) {
      window.alert(error?.message || "Unable to load that ticket.");
    });
  });
}

function subscribeToChanges() {
  const client = requireSupabaseClient();
  if (state.channel) {
    client.removeChannel(state.channel);
  }

  state.channel = client
    .channel("tickets-page-" + state.auth.user.id)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "support_tickets",
      filter: "user_id=eq." + state.auth.user.id
    }, function () {
      refreshSelectedTicket().catch(function () {
        // Ignore transient refresh errors from background events.
      });
    })
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "support_ticket_messages"
    }, function () {
      refreshSelectedTicket().catch(function () {
        // Ignore transient refresh errors from background events.
      });
    })
    .subscribe();
}

async function initTicketsPage() {
  try {
    const auth = await requireAuth();
    if (!auth) {
      return;
    }

    state.auth = auth;
    state.profileName = getDisplayUsername(auth.profile, auth.user);

    populateAuthUI(auth.profile, auth.user);
    bindLogoutButtons();
    bindEvents();

    await loadTickets();
    subscribeToChanges();
  } catch (error) {
    window.alert(error?.message || "Unable to initialize the tickets page.");
  }
}

initTicketsPage();
