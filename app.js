const storageKey = "tutor-class-tracker-classes";
const today = new Date();
const todayKey = formatDate(today);

const sampleClasses = [
  {
    id: "sample-1",
    studentName: "Maya Patel",
    date: todayKey,
    startTime: "09:00",
    endTime: "10:00",
    status: "completed",
    notes: "Algebra review"
  },
  {
    id: "sample-2",
    studentName: "Noah Williams",
    date: todayKey,
    startTime: "11:30",
    endTime: "12:15",
    status: "scheduled",
    notes: "Reading comprehension"
  },
  {
    id: "sample-3",
    studentName: "Sofia Chen",
    date: todayKey,
    startTime: "15:00",
    endTime: "16:00",
    status: "scheduled",
    notes: "Geometry practice"
  },
  {
    id: "sample-4",
    studentName: "Liam Brooks",
    date: todayKey,
    startTime: "17:30",
    endTime: "18:15",
    status: "cancelled",
    notes: "Weekly lesson",
    cancellationReason: "Student unavailable"
  }
];

let classes = loadClasses();
let toastTimeout;
let pendingCancellationId = null;
let editingClassId = null;
let pendingDeleteId = null;
let pendingImportedClasses = null;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
});
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "short" });
const calendarMonthFormatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const selectedDateFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

let calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDateKey = todayKey;

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadClasses() {
  try {
    const savedClasses = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(savedClasses) ? savedClasses : sampleClasses;
  } catch {
    return sampleClasses;
  }
}

function saveClasses() {
  localStorage.setItem(storageKey, JSON.stringify(classes));
}

function createExportPayload() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    classes
  };
}

function validateImportedData(payload) {
  if (!payload || typeof payload !== "object" || payload.version !== 1 || !Array.isArray(payload.classes)) {
    return { valid: false, error: "This file is not a Tutor Class Tracker backup." };
  }

  const ids = new Set();
  const validStatuses = new Set(["scheduled", "completed", "cancelled"]);
  const normalizedClasses = [];

  for (const classItem of payload.classes) {
    if (!classItem || typeof classItem !== "object") {
      return { valid: false, error: "A class record in this file is not valid." };
    }

    const hasValidId = typeof classItem.id === "string" && classItem.id.trim() && !ids.has(classItem.id);
    const hasValidStudent = typeof classItem.studentName === "string" && classItem.studentName.trim();
    const hasValidDate = typeof classItem.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(classItem.date) && formatDate(parseDateKey(classItem.date)) === classItem.date;
    const hasValidTimes = typeof classItem.startTime === "string" && typeof classItem.endTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(classItem.startTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(classItem.endTime) && classItem.endTime > classItem.startTime;
    const hasValidStatus = validStatuses.has(classItem.status);
    const hasValidNotes = classItem.notes === undefined || typeof classItem.notes === "string";
    const hasValidCancellationReason = classItem.cancellationReason === undefined || typeof classItem.cancellationReason === "string";

    if (!hasValidId || !hasValidStudent || !hasValidDate || !hasValidTimes || !hasValidStatus || !hasValidNotes || !hasValidCancellationReason) {
      return { valid: false, error: "One or more class records contain invalid or missing fields." };
    }

    ids.add(classItem.id);
    normalizedClasses.push({
      id: classItem.id,
      studentName: classItem.studentName.trim(),
      date: classItem.date,
      startTime: classItem.startTime,
      endTime: classItem.endTime,
      status: classItem.status,
      notes: classItem.notes || "",
      cancellationReason: classItem.cancellationReason || ""
    });
  }

  return { valid: true, classes: normalizedClasses };
}

function getTodayClasses() {
  return getClassesForDate(getCurrentDateKey());
}

function getClassesForDate(dateKey) {
  return classes
    .filter((classItem) => classItem.date === dateKey)
    .sort((first, second) => first.startTime.localeCompare(second.startTime));
}

function getCurrentDateKey() {
  return formatDate(new Date());
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function getStatusLabel(status) {
  return status === "scheduled" ? "Upcoming" : status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTime(time) {
  const [hours, minutes] = time.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function renderDate() {
  document.querySelector("#current-date").textContent = dateFormatter.format(today);
  document.querySelector("#date-day").textContent = today.getDate();
  document.querySelector("#date-month").textContent = monthFormatter.format(today);
}

function renderSummary(todayClasses) {
  const counts = todayClasses.reduce((summary, classItem) => {
    summary.total += 1;
    summary[classItem.status] += 1;
    return summary;
  }, { total: 0, completed: 0, scheduled: 0, cancelled: 0 });

  document.querySelector("#total-count").textContent = counts.total;
  document.querySelector("#completed-count").textContent = counts.completed;
  document.querySelector("#upcoming-count").textContent = counts.scheduled;
  document.querySelector("#remaining-count").textContent = counts.scheduled;
  document.querySelector("#cancelled-count").textContent = counts.cancelled;
}

function renderNextClass(todayClasses) {
  const target = document.querySelector("#next-class-content");
  const now = new Date();
  const currentDateKey = formatDate(now);
  const currentTime = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const nextClass = todayClasses
    .filter((classItem) => classItem.date === currentDateKey && classItem.status === "scheduled" && timeToMinutes(classItem.startTime) >= currentTime)
    .sort((first, second) => first.startTime.localeCompare(second.startTime))[0];

  if (!nextClass) {
    target.innerHTML = `<div class="next-class-empty">No more classes today.</div>`;
    return;
  }

  target.innerHTML = `
    <article class="next-class-card">
      <div class="next-class-main">
        <div class="next-class-time">
          <strong>${formatTime(nextClass.startTime)}</strong>
          <span>until ${formatTime(nextClass.endTime)}</span>
        </div>
        <div class="next-class-details">
          <strong>${escapeHtml(nextClass.studentName)}</strong>
          <span>${escapeHtml(nextClass.notes || "No notes added")}</span>
        </div>
        <span class="class-status status-upcoming">Upcoming</span>
      </div>
      <button class="button button-primary" type="button" data-action="complete" data-id="${nextClass.id}">Mark complete</button>
    </article>`;
}

function renderClassList(todayClasses) {
  const scheduleList = document.querySelector("#schedule-list");

  if (todayClasses.length === 0) {
    scheduleList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">+</div>
        <h3>A clear day ahead</h3>
        <p>You have no classes scheduled today. Add one when your next lesson is ready.</p>
        <button class="button button-primary" type="button" data-open-form>Add a class</button>
      </div>`;
    return;
  }

  scheduleList.innerHTML = todayClasses.map((classItem) => `
    <article class="class-row ${classItem.status === "cancelled" ? "is-cancelled" : ""}">
      <div class="class-time">
        <strong>${formatTime(classItem.startTime)}</strong>
        ${formatTime(classItem.endTime)}
      </div>
      <div class="class-row-content">
        <div class="class-details">
          <div>
            <div class="class-student">${escapeHtml(classItem.studentName)}</div>
            <p class="class-notes">${escapeHtml(classItem.notes || "No notes added")}</p>
          </div>
          <span class="class-status status-${classItem.status}">${getStatusLabel(classItem.status)}</span>
        </div>
      </div>
      <div class="class-actions">${getActionButtons(classItem)}</div>
    </article>`).join("");
}

function renderCalendar() {
  const calendarGrid = document.querySelector("#calendar-grid");
  if (!calendarGrid) return;

  document.querySelector("#calendar-month-title").textContent = calendarMonthFormatter.format(calendarMonth);
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const calendarStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1 - mondayOffset);
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart.getFullYear(), calendarStart.getMonth(), calendarStart.getDate() + index);
    return date;
  });

  calendarGrid.innerHTML = calendarDays.map((date) => {
    const dateKey = formatDate(date);
    const dayClasses = getClassesForDate(dateKey);
    const completedCount = dayClasses.filter((classItem) => classItem.status === "completed").length;
    const cancelledCount = dayClasses.filter((classItem) => classItem.status === "cancelled").length;
    const isOutsideMonth = date.getMonth() !== calendarMonth.getMonth();
    const isToday = dateKey === todayKey;
    const isSelected = dateKey === selectedDateKey;
    const statusSummary = [
      completedCount ? `${completedCount} completed` : "",
      cancelledCount ? `${cancelledCount} cancelled` : ""
    ].filter(Boolean).join(", ");
    const accessibleLabel = `${selectedDateFormatter.format(date)}${dayClasses.length ? `, ${dayClasses.length} ${dayClasses.length === 1 ? "class" : "classes"}${statusSummary ? `, ${statusSummary}` : ""}` : ", no classes"}`;

    return `
      <button class="calendar-day ${isOutsideMonth ? "is-outside-month" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}" type="button" data-calendar-date="${dateKey}" aria-label="${accessibleLabel}" aria-pressed="${isSelected}">
        <span class="calendar-day-number">${date.getDate()}</span>
        ${dayClasses.length ? `<span class="calendar-day-count">${dayClasses.length} ${dayClasses.length === 1 ? "class" : "classes"}</span>` : ""}
        ${statusSummary ? `<span class="calendar-day-status">${statusSummary}</span>` : ""}
      </button>`;
  }).join("");

  renderSelectedDay();
}

function renderSelectedDay() {
  const selectedClasses = getClassesForDate(selectedDateKey);
  document.querySelector("#selected-date-title").textContent = selectedDateFormatter.format(parseDateKey(selectedDateKey));
  document.querySelector("#selected-day-count").textContent = `${selectedClasses.length} ${selectedClasses.length === 1 ? "class" : "classes"}`;
  renderClassItems(selectedClasses, document.querySelector("#selected-day-list"), "No classes on this date", "This day is clear. Add a class from the dashboard when a lesson is scheduled.");
}

function renderClassItems(classItems, target, emptyTitle = "No matching classes", emptyText = "Try adjusting your filters.") {
  if (classItems.length === 0) {
    target.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">+</div>
        <h3>${emptyTitle}</h3>
        <p>${emptyText}</p>
      </div>`;
    return;
  }

  target.innerHTML = classItems.map((classItem) => `
    <article class="class-row ${classItem.status === "cancelled" ? "is-cancelled" : ""}">
      <div class="class-time">
        <strong>${formatTime(classItem.startTime)}</strong>
        ${formatTime(classItem.endTime)}
      </div>
      <div class="class-row-content">
        <div class="class-details">
          <div>
            <div class="class-student">${escapeHtml(classItem.studentName)}</div>
            <p class="class-notes">${escapeHtml(classItem.notes || "No notes added")}</p>
          </div>
          <span class="class-status status-${classItem.status}">${getStatusLabel(classItem.status)}</span>
        </div>
      </div>
      <div class="class-actions">${getActionButtons(classItem)}</div>
    </article>`).join("");
}

function getActionButtons(classItem) {
  if (classItem.status === "scheduled") {
    return `
      <button class="button button-primary" type="button" data-action="complete" data-id="${classItem.id}">Mark complete</button>
      ${getSecondaryActionMenu(classItem)}`;
  }

  return getSecondaryActionMenu(classItem);
}

function getSecondaryActionMenu(classItem) {
  const restoreLabel = classItem.status === "cancelled" ? "Restore" : "Reopen";
  return `
    <div class="action-menu">
      <button class="button button-secondary action-menu-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${escapeHtml(classItem.studentName)}">More</button>
      <div class="action-menu-items" role="menu" hidden>
        ${classItem.status === "scheduled" ? `<button class="action-menu-item" type="button" role="menuitem" data-action="cancel" data-id="${classItem.id}">Cancel</button>` : `<button class="action-menu-item" type="button" role="menuitem" data-action="reopen" data-id="${classItem.id}">${restoreLabel}</button>`}
        <button class="action-menu-item" type="button" role="menuitem" data-action="edit" data-id="${classItem.id}">Edit</button>
        <button class="action-menu-item action-menu-item-danger" type="button" role="menuitem" data-action="delete" data-id="${classItem.id}">Delete</button>
      </div>
    </div>`;
}

function render() {
  const todayClasses = getTodayClasses();
  renderSummary(todayClasses);
  renderNextClass(todayClasses);
  renderClassList(todayClasses);
  renderCalendar();
  renderHistory();
  renderDataSummary();
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function showView(viewName) {
  document.querySelector("#today").hidden = viewName !== "today";
  document.querySelector("#schedule-view").hidden = viewName !== "schedule";
  document.querySelector("#history-view").hidden = viewName !== "history";
  document.querySelector("#data-view").hidden = viewName !== "data";
  document.querySelectorAll("[data-view-target]").forEach((link) => {
    const isActive = link.dataset.viewTarget === viewName;
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function renderDataSummary() {
  const count = document.querySelector("#data-class-count");
  if (count) count.textContent = classes.length;
}

function exportData() {
  const payload = JSON.stringify(createExportPayload(), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `tutor-class-tracker-backup-${todayKey}.json`;
  link.click();
  URL.revokeObjectURL(downloadUrl);
  showToast("Backup downloaded");
}

function showDataError(message) {
  const error = document.querySelector("#data-error");
  error.textContent = message;
  error.hidden = false;
}

async function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.querySelector("#data-error").hidden = true;

  try {
    const payload = JSON.parse(await file.text());
    const validation = validateImportedData(payload);
    if (!validation.valid) {
      showDataError(validation.error);
      event.target.value = "";
      return;
    }

    pendingImportedClasses = validation.classes;
    document.querySelector("#import-count").textContent = pendingImportedClasses.length;
    document.querySelector("#import-dialog").showModal();
  } catch {
    showDataError("This file could not be read as valid JSON.");
    event.target.value = "";
  }
}

function closeImportDialog() {
  pendingImportedClasses = null;
  document.querySelector("#import-dialog").close();
  document.querySelector("#import-file").value = "";
}

function handleImportSubmit(event) {
  event.preventDefault();
  if (!pendingImportedClasses) return;
  classes = pendingImportedClasses;
  saveClasses();
  window.location.reload();
}

function openClearDataDialog() {
  document.querySelector("#clear-data-dialog").showModal();
}

function closeClearDataDialog() {
  document.querySelector("#clear-data-dialog").close();
}

function handleClearDataSubmit(event) {
  event.preventDefault();
  classes = [];
  saveClasses();
  closeClearDataDialog();
  render();
  showToast("All class data cleared");
}

function getHistoryClasses() {
  const startDate = document.querySelector("#history-start-date").value;
  const endDate = document.querySelector("#history-end-date").value;
  const status = document.querySelector("#history-status").value;
  const student = document.querySelector("#history-student").value;

  return classes
    .filter((classItem) => (!startDate || classItem.date >= startDate) && (!endDate || classItem.date <= endDate))
    .filter((classItem) => status === "all" || classItem.status === status)
    .filter((classItem) => student === "all" || classItem.studentName === student)
    .sort((first, second) => `${first.date}${first.startTime}`.localeCompare(`${second.date}${second.startTime}`));
}

function getHistoryPresetRange(preset) {
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (todayDate.getDay() + 6) % 7;
  const thisWeekStart = new Date(todayDate);
  thisWeekStart.setDate(todayDate.getDate() - mondayOffset);

  if (preset === "today") return { start: todayDate, end: todayDate };
  if (preset === "this-week") {
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
    return { start: thisWeekStart, end: thisWeekEnd };
  }
  if (preset === "last-week") {
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
    return { start: lastWeekStart, end: lastWeekEnd };
  }
  if (preset === "this-month") return { start: new Date(todayDate.getFullYear(), todayDate.getMonth(), 1), end: todayDate };
  if (preset === "last-month") return {
    start: new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1),
    end: new Date(todayDate.getFullYear(), todayDate.getMonth(), 0)
  };
  return null;
}

function applyHistoryPreset(preset) {
  const range = getHistoryPresetRange(preset);
  if (!range) return;
  document.querySelector("#history-start-date").value = formatDate(range.start);
  document.querySelector("#history-end-date").value = formatDate(range.end);
  renderHistory();
}

function renderHistoryPresetState() {
  const startDate = document.querySelector("#history-start-date").value;
  const endDate = document.querySelector("#history-end-date").value;
  document.querySelectorAll("[data-history-preset]").forEach((button) => {
    const range = getHistoryPresetRange(button.dataset.historyPreset);
    const isActive = range && startDate === formatDate(range.start) && endDate === formatDate(range.end);
    button.classList.toggle("is-active", Boolean(isActive));
    button.setAttribute("aria-pressed", String(Boolean(isActive)));
  });
}

function renderHistoryStudentOptions() {
  const studentSelect = document.querySelector("#history-student");
  const selectedStudent = studentSelect.value;
  const students = [...new Set(classes.map((classItem) => classItem.studentName))].sort((first, second) => first.localeCompare(second));
  studentSelect.innerHTML = `<option value="all">All students</option>${students.map((student) => `<option value="${escapeHtml(student)}">${escapeHtml(student)}</option>`).join("")}`;
  studentSelect.value = students.includes(selectedStudent) ? selectedStudent : "all";
}

function renderHistory() {
  const historyList = document.querySelector("#history-list");
  if (!historyList) return;

  renderHistoryStudentOptions();
  const historyClasses = getHistoryClasses();
  const counts = historyClasses.reduce((summary, classItem) => {
    summary.total += 1;
    summary[classItem.status] += 1;
    return summary;
  }, { total: 0, completed: 0, cancelled: 0, scheduled: 0 });

  document.querySelector("#history-total-count").textContent = counts.total;
  document.querySelector("#history-completed-count").textContent = counts.completed;
  document.querySelector("#history-cancelled-count").textContent = counts.cancelled;
  document.querySelector("#history-scheduled-count").textContent = counts.scheduled;
  document.querySelector("#history-result-count").textContent = `${counts.total} ${counts.total === 1 ? "record" : "records"}`;

  const rates = document.querySelector("#history-rates");
  if (counts.total) {
    rates.hidden = false;
    rates.innerHTML = `<span>Completion rate <strong>${Math.round((counts.completed / counts.total) * 100)}%</strong></span><span>Cancellation rate <strong>${Math.round((counts.cancelled / counts.total) * 100)}%</strong></span>`;
  } else {
    rates.hidden = true;
    rates.innerHTML = "";
  }

  const startDate = document.querySelector("#history-start-date").value;
  const endDate = document.querySelector("#history-end-date").value;
  document.querySelector("#history-period").textContent = startDate || endDate ? `${startDate || "Any date"} to ${endDate || "Any date"}` : "All saved classes";
  renderHistoryPresetState();
  renderClassItems(historyClasses, historyList, "No matching classes", "Try adjusting your date, status, or student filters.");
}

function moveCalendarMonth(offset) {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
  selectedDateKey = formatDate(calendarMonth);
  renderCalendar();
}

function selectCalendarDate(dateKey) {
  selectedDateKey = dateKey;
  const date = parseDateKey(dateKey);
  calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  renderCalendar();
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[character]));
}

function updateStatus(id, status, cancellationReason = "") {
  classes = classes.map((classItem) => classItem.id === id ? {
    ...classItem,
    status,
    cancellationReason: status === "cancelled" ? cancellationReason : ""
  } : classItem);
  saveClasses();
  render();
  showToast(status === "completed" ? "Class marked complete" : status === "cancelled" ? "Class cancelled" : "Class reopened");
}

function openCancellationDialog(id) {
  pendingCancellationId = id;
  const dialog = document.querySelector("#cancellation-dialog");
  dialog.querySelector("#cancellation-form").reset();
  dialog.showModal();
  dialog.querySelector("select[name=cancellationReason]").focus();
}

function closeCancellationDialog() {
  pendingCancellationId = null;
  document.querySelector("#cancellation-dialog").close();
}

function handleCancellationSubmit(event) {
  event.preventDefault();
  const reason = new FormData(event.currentTarget).get("cancellationReason");
  if (pendingCancellationId) updateStatus(pendingCancellationId, "cancelled", reason);
  closeCancellationDialog();
}

function openForm(classId = null) {
  const dialog = document.querySelector("#class-dialog");
  const form = document.querySelector("#class-form");
  const dateInput = form.querySelector("input[name=date]");
  const classItem = classes.find((item) => item.id === classId);
  editingClassId = classItem ? classId : null;
  document.querySelector("#form-error").hidden = true;
  form.reset();
  form.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
  form.querySelector("[data-edit-only]").hidden = !editingClassId;
  document.querySelector("#form-eyebrow").textContent = editingClassId ? "Update entry" : "New entry";
  document.querySelector("#dialog-title").textContent = editingClassId ? "Edit class" : "Add a class";
  document.querySelector("[data-form-submit]").textContent = editingClassId ? "Save changes" : "Save class";

  if (classItem) {
    form.querySelector("input[name=studentName]").value = classItem.studentName;
    dateInput.value = classItem.date;
    form.querySelector("input[name=startTime]").value = classItem.startTime;
    form.querySelector("input[name=endTime]").value = classItem.endTime;
    form.querySelector("select[name=status]").value = classItem.status;
    form.querySelector("textarea[name=notes]").value = classItem.notes || "";
  } else {
    dateInput.value = todayKey;
  }
  dialog.showModal();
  dialog.querySelector("input[name=studentName]").focus();
}

function closeForm() {
  editingClassId = null;
  document.querySelector("#class-dialog").close();
}

function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const studentName = formData.get("studentName").trim();
  const date = formData.get("date");
  const startTime = formData.get("startTime");
  const endTime = formData.get("endTime");

  if (!studentName) {
    showFormError("Enter the student's name.", "studentName");
    return;
  }

  if (!date) {
    showFormError("Choose a date for this class.", "date");
    return;
  }

  if (!startTime || !endTime) {
    showFormError("Enter both a start time and an end time.", !startTime ? "startTime" : "endTime");
    return;
  }

  if (endTime <= startTime) {
    showFormError("End time must be later than the start time.", "endTime");
    return;
  }

  const status = editingClassId ? formData.get("status") : "scheduled";
  const wasEditing = Boolean(editingClassId);
  const classData = { studentName, date, startTime, endTime, status, notes: formData.get("notes").trim() };

  if (editingClassId) {
    classes = classes.map((classItem) => classItem.id === editingClassId ? {
      ...classItem,
      ...classData,
      cancellationReason: status === "cancelled" ? classItem.cancellationReason || "" : ""
    } : classItem);
  } else {
    classes.push({ id: generateClassId(), ...classData, cancellationReason: "" });
  }
  saveClasses();
  closeForm();
  render();
  showToast(wasEditing ? "Class updated" : date === todayKey ? "Class added to today's schedule" : "Class added to the schedule");
}

function generateClassId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `class-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function showFormError(message, fieldName) {
  const formError = document.querySelector("#form-error");
  const field = document.querySelector(`[name="${fieldName}"]`);
  document.querySelectorAll("[aria-invalid]").forEach((invalidField) => invalidField.removeAttribute("aria-invalid"));
  field.setAttribute("aria-invalid", "true");
  formError.textContent = message;
  formError.hidden = false;
  field.focus();
}

function openDeleteDialog(id) {
  pendingDeleteId = id;
  document.querySelector("#delete-dialog").showModal();
  document.querySelector("[data-close-delete]").focus();
}

function closeDeleteDialog() {
  pendingDeleteId = null;
  document.querySelector("#delete-dialog").close();
}

function handleDeleteSubmit(event) {
  event.preventDefault();
  if (!pendingDeleteId) return;
  classes = classes.filter((classItem) => classItem.id !== pendingDeleteId);
  saveClasses();
  closeDeleteDialog();
  render();
  showToast("Class deleted");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function closeActionMenus() {
  document.querySelectorAll(".action-menu-items").forEach((menu) => {
    menu.hidden = true;
    menu.previousElementSibling.setAttribute("aria-expanded", "false");
  });
}

function toggleActionMenu(toggle) {
  const menu = toggle.nextElementSibling;
  const shouldOpen = menu.hidden;
  closeActionMenus();
  menu.hidden = !shouldOpen;
  toggle.setAttribute("aria-expanded", String(shouldOpen));
}

document.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open-form]");
  const closeButton = event.target.closest("[data-close-form]");
  const actionButton = event.target.closest("[data-action]");
  const disabledLink = event.target.closest("[data-disabled-link]");
  const viewTarget = event.target.closest("[data-view-target]");
  const calendarNav = event.target.closest("[data-calendar-nav]");
  const calendarDate = event.target.closest("[data-calendar-date]");
  const calendarToday = event.target.closest("[data-calendar-today]");
  const historyForm = event.target.closest("#history-filters");
  const historyPreset = event.target.closest("[data-history-preset]");
  const actionMenuToggle = event.target.closest(".action-menu-toggle");
  const viewDataButton = event.target.closest("[data-export-data]");
  const clearDataButton = event.target.closest("[data-clear-data]");

  if (actionMenuToggle) {
    toggleActionMenu(actionMenuToggle);
    return;
  }
  closeActionMenus();
  if (viewTarget) {
    event.preventDefault();
    showView(viewTarget.dataset.viewTarget);
  }
  if (openButton) openForm();
  if (closeButton) closeForm();
  if (disabledLink) {
    event.preventDefault();
    showToast("This section is coming in a later update");
  }
  if (calendarNav) moveCalendarMonth(calendarNav.dataset.calendarNav === "next" ? 1 : -1);
  if (calendarToday) selectCalendarDate(todayKey);
  if (calendarDate) selectCalendarDate(calendarDate.dataset.calendarDate);
  if (historyPreset) applyHistoryPreset(historyPreset.dataset.historyPreset);
  if (historyForm) renderHistory();
  if (viewDataButton) exportData();
  if (clearDataButton) openClearDataDialog();
  if (actionButton) {
    const status = actionButton.dataset.action;
    if (status === "cancel") {
      openCancellationDialog(actionButton.dataset.id);
    } else if (status === "edit") {
      openForm(actionButton.dataset.id);
    } else if (status === "delete") {
      openDeleteDialog(actionButton.dataset.id);
    } else {
      updateStatus(actionButton.dataset.id, status === "complete" ? "completed" : "scheduled");
    }
  }
});

document.querySelector("#class-form").addEventListener("submit", handleFormSubmit);
document.querySelector("#class-form").addEventListener("input", (event) => {
  if (event.target.matches("[aria-invalid]")) event.target.removeAttribute("aria-invalid");
  document.querySelector("#form-error").hidden = true;
});
document.querySelector("#class-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeForm();
});
document.querySelector("#cancellation-form").addEventListener("submit", handleCancellationSubmit);
document.querySelector("#cancellation-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeCancellationDialog();
  if (event.target.closest("[data-close-cancellation]")) closeCancellationDialog();
});
document.querySelector("#delete-form").addEventListener("submit", handleDeleteSubmit);
document.querySelector("#delete-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeDeleteDialog();
  if (event.target.closest("[data-close-delete]")) closeDeleteDialog();
});
document.querySelector("#history-filters").addEventListener("input", renderHistory);
document.querySelector("#history-filters").addEventListener("change", renderHistory);
document.querySelector("#history-filters").addEventListener("reset", () => setTimeout(renderHistory));
document.querySelector("#import-file").addEventListener("change", handleImportFile);
document.querySelector("#import-form").addEventListener("submit", handleImportSubmit);
document.querySelector("#import-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-import]")) closeImportDialog();
});
document.querySelector("#clear-data-form").addEventListener("submit", handleClearDataSubmit);
document.querySelector("#clear-data-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-clear]")) closeClearDataDialog();
});

renderDate();
render();
