package edu.iter.eduhub.feature.main

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import edu.iter.eduhub.app.navigation.DrawerDestinations
import edu.iter.eduhub.core.model.*
import edu.iter.eduhub.core.ui.*
import kotlinx.serialization.json.JsonElement

@Composable
fun LandingScreen(
    publicState: UiState<PublicContent>,
    onLogin: () -> Unit,
    onRegister: () -> Unit,
    onCreator: () -> Unit,
    onConnectPortal: () -> Unit
) {
    when (publicState) {
        UiState.Loading -> LoadingState()
        is UiState.Error -> ErrorState(publicState.message)
        is UiState.Success -> ScreenScaffold(
            title = publicState.value.landing.title.ifBlank { "ITER EduHub" },
            subtitle = publicState.value.landing.subtitle
        ) {
            SectionCard(title = "What this app is", subtitle = "Native Android 10+ client") {
                Text("The app mirrors public, student, teacher, and admin flows with native screens and backend APIs.")
            }
            SectionCard(title = "Public routes", subtitle = "Mapped from the web information architecture") {
                ChipRow(listOf("/", "/login.html", "/register.html", "/creator.html", "/connect-portal.html"))
            }
            ActionButtons(primaryLabel = "Sign in", onPrimary = onLogin, secondaryLabel = "Register", onSecondary = onRegister)
            ActionButtons(primaryLabel = "Creator", onPrimary = onCreator, secondaryLabel = "Connect portal", onSecondary = onConnectPortal)
        }
        UiState.Idle -> LoadingState()
    }
}

@Composable
fun CreatorScreen(publicState: UiState<PublicContent>, onBack: () -> Unit) {
    val content = (publicState as? UiState.Success)?.value?.creator
    ScreenScaffold(title = content?.title ?: "Creator", subtitle = content?.subtitle ?: "Architecture and migration context") {
        SectionCard(title = "Independent from the web frontend") {
            Text("This Android client reuses backend contracts only. No WebView, iframe, TWA, or wrapper UI is used for core flows.")
        }
        content?.sections?.forEach { section ->
            SectionCard(title = section.title, subtitle = section.highlight) {
                Text(section.body)
            }
        }
        TextButton(onClick = onBack) { Text("Back") }
    }
}

@Composable
fun ConnectPortalScreen(
    publicState: UiState<PublicContent>,
    portalViewModel: PortalViewModel,
    session: AppSession?,
    onBack: () -> Unit
) {
    val content = (publicState as? UiState.Success)?.value?.connectPortal
    val portalStatusState by portalViewModel.portalStatusState.collectAsStateWithLifecycle()
    val portalDataState by portalViewModel.portalDataState.collectAsStateWithLifecycle()
    val portalBusy by portalViewModel.portalBusy.collectAsStateWithLifecycle()
    var registrationNumber by rememberSaveable(session?.user?.registration_number) {
        mutableStateOf(session?.user?.registration_number.orEmpty())
    }
    var password by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(session?.user?.id) {
        portalViewModel.loadPortalStatus()
    }

    val statusValue = (portalStatusState as? UiState.Success)?.value
    LaunchedEffect(session?.user?.id, statusValue?.portalConnected) {
        if (session != null && statusValue?.portalConnected == true) {
            portalViewModel.loadPortalData()
        }
    }
    val canLoadStoredData = session != null
    val canRecover = session != null || registrationNumber.isNotBlank()
    val canConnect = registrationNumber.isNotBlank() && password.isNotBlank() && !portalBusy

    ScreenScaffold(
        title = content?.title ?: "Connect Portal",
        subtitle = content?.subtitle ?: "Native SOA portal sync and fallback flow"
    ) {
        SectionCard(
            title = "Portal status",
            subtitle = "Checks backend availability and your current connection state"
        ) {
            when (portalStatusState) {
                UiState.Loading -> {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Checking portal status…")
                }
                is UiState.Error -> {
                    Text((portalStatusState as UiState.Error).message)
                }
                is UiState.Success -> {
                    val status = statusValue ?: PortalStatusPayload()
                    ChipRow(
                        buildList {
                            add(if (status.portalEnabled) "Portal enabled" else "Portal disabled")
                            add(if (status.portalConnected) "Connected" else "Not connected")
                            add(if (status.isVerified) "Verified data" else "Fallback/demo data")
                            status.lastSynced?.let { add("Last synced: $it") }
                        }
                    )
                    status.message?.let {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(it)
                    }
                }
                UiState.Idle -> Text("Portal status not loaded yet.")
            }
            Spacer(modifier = Modifier.height(12.dp))
            TextButton(onClick = portalViewModel::loadPortalStatus, enabled = !portalBusy) {
                Text("Refresh status")
            }
        }

        SectionCard(
            title = "Portal sync",
            subtitle = "Connect live portal credentials, recover backup data, or use demo mode"
        ) {
            OutlinedTextField(
                value = registrationNumber,
                onValueChange = { registrationNumber = it },
                label = { Text("Registration number") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Portal password") },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth()
            )
            if (portalBusy) {
                Spacer(modifier = Modifier.height(12.dp))
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                enabled = canConnect,
                onClick = { portalViewModel.connectPortal(registrationNumber, password) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Connect live")
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(
                enabled = canRecover && !portalBusy,
                onClick = { portalViewModel.recoverPortalData(registrationNumber) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Load backup")
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(
                enabled = !portalBusy,
                onClick = portalViewModel::loadPortalDemo,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Use demo")
            }
            if (canLoadStoredData) {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    enabled = !portalBusy,
                    onClick = portalViewModel::loadPortalData,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Load stored data")
                }
            }
            if (session != null && statusValue?.portalConnected == true) {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    enabled = !portalBusy,
                    onClick = portalViewModel::disconnectPortal,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Disconnect portal")
                }
            }
        }

        when (portalDataState) {
            UiState.Idle -> SectionCard(title = "Portal data") {
                Text("Load live, backup, or demo portal data to inspect what the native client will use.")
            }
            UiState.Loading -> SectionCard(title = "Portal data") {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(12.dp))
                Text("Loading portal data…")
            }
            is UiState.Error -> SectionCard(title = "Portal data") {
                Text((portalDataState as UiState.Error).message)
            }
            is UiState.Success -> {
                val data = (portalDataState as UiState.Success<PortalDataPayload>).value
                SectionCard(
                    title = data.profile.name ?: "Portal student profile",
                    subtitle = data.dataSource ?: if (data.portalConnected) "live_portal" else "demo"
                ) {
                    ChipRow(
                        buildList {
                            add(if (data.portalConnected) "Connected" else "Not connected")
                            add(if (data.isVerified) "Verified" else "Fallback")
                            data.warning?.let { add("Warning") }
                        }
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Registration: ${data.profile.registration_number ?: registrationNumber.ifBlank { "N/A" }}")
                    Text("Department: ${data.profile.department ?: session?.user?.department ?: "N/A"}")
                    Text("Semester: ${data.profile.semester.displayText() ?: session?.user?.semester ?: "N/A"}")
                    Text("Section: ${data.profile.section ?: session?.user?.section ?: "N/A"}")
                    Text("Email: ${data.profile.email ?: session?.user?.email ?: "N/A"}")
                    data.warning?.let {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(it)
                    }
                }

                SectionCard(title = "Portal summary", subtitle = "Counts available to native student flows") {
                    val metrics = listOf(
                        MetricItem("Marks", data.marks.size.toString(), "Portal marks records"),
                        MetricItem("Attendance", data.attendance.size.toString(), "Portal attendance subjects"),
                        MetricItem("Timetable", data.timetable.size.toString(), "Portal timetable entries"),
                        MetricItem("Notices", data.notifications.size.toString(), "Portal notices")
                    )
                    metrics.chunked(2).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            row.forEach { metric ->
                                MetricCard(
                                    title = metric.title,
                                    value = metric.value,
                                    detail = metric.detail,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                }

                if (data.marks.isNotEmpty()) {
                    SectionCard(title = "Recent marks") {
                        data.marks.take(4).forEach { mark ->
                            ListRow(
                                title = mark.subject ?: "Subject",
                                subtitle = mark.exam_type ?: mark.subject_code,
                                trailing = buildString {
                                    append(mark.marks.displayText() ?: "-")
                                    mark.total_marks.displayText()?.let { append("/$it") }
                                    mark.grade?.let { append(" • $it") }
                                }
                            )
                        }
                    }
                }

                if (data.attendance.isNotEmpty()) {
                    SectionCard(title = "Attendance from portal") {
                        data.attendance.take(4).forEach { record ->
                            ListRow(
                                title = record.subject ?: "Subject",
                                subtitle = record.teacher ?: record.subject_code,
                                trailing = buildString {
                                    record.attended.displayText()?.let { append(it) }
                                    record.total.displayText()?.let { total ->
                                        if (isNotBlank()) append("/")
                                        append(total)
                                    }
                                    record.percentage.displayText()?.let { percentage ->
                                        if (isNotBlank()) append(" • ")
                                        append(percentage)
                                    }
                                }.ifBlank { "No summary" }
                            )
                        }
                    }
                }

                if (data.timetable.isNotEmpty()) {
                    SectionCard(title = "Timetable from portal") {
                        data.timetable.take(4).forEach { slot ->
                            ListRow(
                                title = slot.subject ?: "Class",
                                subtitle = listOfNotNull(slot.day, slot.time_slot).joinToString(" • ").ifBlank { null },
                                trailing = slot.room ?: ""
                            )
                        }
                    }
                }
            }
        }

        content?.sections?.forEach { section ->
            SectionCard(title = section.title, subtitle = section.highlight) {
                Text(section.body)
            }
        }

        TextButton(onClick = onBack) { Text("Back") }
    }
}

@Composable
fun DashboardScreen(
    portalViewModel: PortalViewModel,
    onNavigate: (String) -> Unit
) = SnapshotScreen(
    portalViewModel = portalViewModel,
    title = "Dashboard"
) { snapshot ->
    SectionCard(title = snapshot.dashboard.heroTitle, subtitle = snapshot.dashboard.heroSubtitle) {
        snapshot.dashboard.metrics.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { metric ->
                    MetricCard(
                        title = metric.title,
                        value = metric.value,
                        detail = metric.detail,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
        }
    }
    if (snapshot.user.userRole == UserRole.STUDENT) {
        SectionCard(title = "Portal sync", subtitle = "Native portal integration status") {
            ChipRow(
                buildList {
                    add(if (snapshot.portal.enabled) "Portal enabled" else "Portal disabled")
                    add(if (snapshot.portal.connected) "Connected" else "Not connected")
                    add(if (snapshot.portal.verified) "Verified data" else "Fallback/demo data")
                    snapshot.portal.dataSource?.let { add(it) }
                }
            )
            snapshot.portal.lastSynced?.let {
                Spacer(modifier = Modifier.height(12.dp))
                Text("Last synced: $it")
            }
        }
    }
    SectionCard(title = "Feature parity routes", subtitle = "Native navigation for every supported role page") {
        val role = snapshot.user.userRole
        DrawerDestinations.filter { role in it.roles }.forEach { destination ->
            ListRow(
                title = destination.title,
                subtitle = destination.route,
                actionLabel = "Open"
            ) { onNavigate(destination.route) }
        }
    }
}

@Composable
fun NotificationsScreen(portalViewModel: PortalViewModel) {
    val notificationsState by portalViewModel.notificationsState.collectAsStateWithLifecycle()
    when (notificationsState) {
        UiState.Loading -> LoadingState()
        is UiState.Error -> ErrorState((notificationsState as UiState.Error).message, portalViewModel::loadNotifications)
        is UiState.Success -> {
            val items = (notificationsState as UiState.Success<List<NotificationItem>>).value
            if (items.isEmpty()) {
                EmptyState("No notifications", "Notification center parity is wired, but there are no notifications right now.")
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(items) { item ->
                        SectionCard(title = item.title, subtitle = item.type) {
                            Text(item.message)
                            Spacer(modifier = Modifier.height(12.dp))
                            if (!item.is_read) {
                                Button(onClick = { portalViewModel.markNotificationRead(item.id) }) {
                                    Text("Mark read")
                                }
                            }
                        }
                    }
                }
            }
        }
        UiState.Idle -> LoadingState()
    }
}

@Composable
fun SearchScreen(portalViewModel: PortalViewModel) {
    val searchState by portalViewModel.searchState.collectAsStateWithLifecycle()
    var query by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = {
                query = it
                portalViewModel.search(it)
            },
            label = { Text("Search users, files, events, announcements") },
            modifier = Modifier.fillMaxWidth()
        )
        when (searchState) {
            UiState.Idle -> Text("Search API is backed by the server. Start typing to query it.")
            UiState.Loading -> LoadingState("Searching…")
            is UiState.Error -> ErrorState((searchState as UiState.Error).message)
            is UiState.Success -> {
                val results = (searchState as UiState.Success<List<SearchResultItem>>).value
                if (results.isEmpty()) {
                    EmptyState("No results", "Try a different search term.")
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f, fill = true),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(results) { item ->
                            SectionCard(title = item.name, subtitle = item.type) {
                                Text(item.description ?: item.subject ?: "No description")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ProfileScreen(session: AppSession?, portalViewModel: PortalViewModel) = SnapshotScreen(
    portalViewModel = portalViewModel,
    title = "Profile"
) { snapshot ->
    val activeSession = session ?: return@SnapshotScreen
    SectionCard(title = activeSession.user.name, subtitle = activeSession.user.role.replaceFirstChar(Char::titlecase)) {
        Text("Registration: ${activeSession.user.registration_number ?: "N/A"}")
        Text("Email: ${activeSession.user.email ?: "N/A"}")
        Text("Department: ${activeSession.user.department ?: "N/A"}")
        Text("Year / Section: ${activeSession.user.year ?: "-"} / ${activeSession.user.section ?: "-"}")
        Text("Auth mode: ${activeSession.authMode ?: "session"}")
        Spacer(modifier = Modifier.height(12.dp))
        Button(onClick = { portalViewModel.signOut() }) { Text("Sign out") }
    }
    SectionCard(title = "Navigation grants") {
        ChipRow(snapshot.navigation.map { it.label })
    }
    if (snapshot.user.userRole == UserRole.STUDENT) {
        SectionCard(title = "Portal sync") {
            Text("Connected: ${if (snapshot.portal.connected) "Yes" else "No"}")
            Text("Verified: ${if (snapshot.portal.verified) "Yes" else "No"}")
            Text("Source: ${snapshot.portal.dataSource ?: "N/A"}")
            Text("Last synced: ${snapshot.portal.lastSynced ?: "N/A"}")
        }
    }
}

@Composable
fun FileCenterScreen(portalViewModel: PortalViewModel) = SnapshotScreen(
    portalViewModel = portalViewModel,
    title = "Files"
) { snapshot ->
    val actionBusy by portalViewModel.actionBusy.collectAsStateWithLifecycle()
    var fileUri by remember { mutableStateOf<Uri?>(null) }
    var uploadName by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf("other") }
    var subject by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("Uploaded from Android") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> fileUri = uri }
    LaunchedEffect(fileUri) {
        if (fileUri != null && uploadName.isBlank()) {
            uploadName = fileUri?.lastPathSegment?.substringAfterLast('/') ?: "attachment"
        }
    }
    SectionCard(title = "Shared file hub", subtitle = "Uploads, downloads, and attachment handling") {
        Button(onClick = { picker.launch(arrayOf("*/*")) }) { Text("Select file") }
        fileUri?.let { uri ->
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = uploadName,
                onValueChange = { uploadName = it },
                label = { Text("File name") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = category,
                onValueChange = { category = it },
                label = { Text("Category") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = subject,
                onValueChange = { subject = it },
                label = { Text("Subject (optional)") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                enabled = uploadName.isNotBlank() && category.isNotBlank() && !actionBusy,
                onClick = {
                    portalViewModel.uploadFile(
                        fileUri = uri,
                        fileName = uploadName,
                        category = category,
                        subject = subject.takeIf { it.isNotBlank() },
                        description = description.takeIf { it.isNotBlank() }
                    )
                }
            ) {
                Text(if (actionBusy) "Uploading…" else "Upload selected file")
            }
        }
    }
    if (snapshot.shared.fileHub.isEmpty()) {
        EmptyState("No files", "The backend did not return files for the shared hub.")
    } else {
        snapshot.shared.fileHub.forEach { document ->
            SectionCard(title = document.title, subtitle = document.subject ?: document.type) {
                Text(document.description ?: "No description")
                Spacer(modifier = Modifier.height(12.dp))
                ActionButtons(
                    primaryLabel = "Open",
                    onPrimary = {
                        document.downloadUrl?.let { url ->
                            portalViewModel.downloadProtectedFile(url, document.fileName ?: "${document.title}.pdf") {
                                portalViewModel.openCachedFile(it)
                            }
                        } ?: portalViewModel.downloadFile(document.id, document.fileName ?: "${document.title}.pdf") {
                            portalViewModel.openCachedFile(it)
                        }
                    },
                    secondaryLabel = "Queue download",
                    onSecondary = {
                        document.downloadUrl?.let { portalViewModel.enqueueExternalDownload(it, document.fileName ?: document.title) }
                    }
                )
            }
        }
    }
}

@Composable
fun StudentAttendanceScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Student Attendance") { snapshot ->
    val attendance = snapshot.student?.attendance ?: AttendancePayload()
    SectionCard(title = "Attendance summary", subtitle = "Matches /dashboard/student-attendance.html") {
        if (attendance.summary.isEmpty()) {
            Text("No attendance records available.")
        } else {
            attendance.summary.forEach {
                ListRow(
                    title = it.subject,
                    subtitle = "${it.present_count}/${it.total_classes} present",
                    trailing = "${it.percentage ?: 0.0}%"
                )
            }
        }
    }
}

@Composable
fun StudentMarksScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Student Marks") { snapshot ->
    val marks = snapshot.student?.marks ?: MarksPayload()
    SectionCard(title = "Current performance", subtitle = "Matches /dashboard/student-marks.html") {
        MetricCard(title = "CGPA", value = marks.cgpa?.toString() ?: "N/A")
        Spacer(modifier = Modifier.height(12.dp))
        marks.summary.forEach {
            ListRow(
                title = it.subject,
                subtitle = it.exam_type ?: "Average",
                trailing = "${it.avg_marks}/${it.avg_total}"
            )
        }
    }
}

@Composable
fun StudentTimetableScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Student Timetable") { snapshot ->
    val items = snapshot.student?.timetable.orEmpty()
    SectionCard(title = "Class schedule", subtitle = "Matches /dashboard/student-timetable.html") {
        if (items.isEmpty()) {
            Text("No timetable available.")
        } else {
            items.forEach {
                ListRow(
                    title = "${it.day_of_week} • ${it.subject}",
                    subtitle = "${it.start_time} - ${it.end_time ?: "TBD"} • ${it.room ?: "Room TBD"}",
                    trailing = it.teacher_name ?: ""
                )
            }
        }
    }
}

@Composable
fun StudentNotesScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Student Notes") { snapshot ->
    val notes = snapshot.student?.notes.orEmpty()
    if (notes.isEmpty()) {
        EmptyState("No notes", "The notes flow is wired, but the snapshot is empty.")
    } else {
        notes.forEach { note ->
            SectionCard(title = note.title, subtitle = note.subject ?: note.type) {
                Text(note.description ?: "Download or preview the material natively.")
                Spacer(modifier = Modifier.height(12.dp))
                ActionButtons(
                    primaryLabel = "Open",
                    onPrimary = {
                        note.downloadUrl?.let { url ->
                            portalViewModel.downloadProtectedFile(url, note.fileName ?: "${note.title}.pdf") {
                                portalViewModel.openCachedFile(it)
                            }
                        } ?: portalViewModel.downloadFile(note.id, note.fileName ?: "${note.title}.pdf") {
                            portalViewModel.openCachedFile(it)
                        }
                    },
                    secondaryLabel = "Queue download",
                    onSecondary = {
                        note.downloadUrl?.let { portalViewModel.enqueueExternalDownload(it, note.fileName ?: note.title) }
                    }
                )
            }
        }
    }
}

@Composable
fun StudentAdmitCardScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Admit Card") { snapshot ->
    val admitCard = snapshot.student?.admitCard
    if (admitCard == null) {
        EmptyState("No admit card", "The backend did not return an admit card for the current session.")
    } else {
        SectionCard(title = admitCard.exam_name, subtitle = admitCard.exam_code) {
            Text("Exam date: ${admitCard.exam_date ?: "TBD"}")
            Spacer(modifier = Modifier.height(12.dp))
            ActionButtons(
                primaryLabel = "Open",
                onPrimary = {
                    (admitCard.download_url ?: admitCard.public_url)?.let { url ->
                        portalViewModel.downloadProtectedFile(url, "${admitCard.exam_name}.pdf") {
                            portalViewModel.openCachedFile(it)
                        }
                    }
                },
                secondaryLabel = "Queue download",
                onSecondary = {
                    admitCard.download_url?.let { portalViewModel.enqueueExternalDownload(it, "${admitCard.exam_name}.pdf") }
                }
            )
        }
    }
}

@Composable
fun StudentEventsScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Student Events") { snapshot ->
    val events = snapshot.student?.events.orEmpty()
    if (events.isEmpty()) {
        EmptyState("No events", "Event parity is wired through the backend, but there are no active events.")
    } else {
        events.forEach { event ->
            SectionCard(title = event.title, subtitle = event.category) {
                Text(event.description ?: "No description")
                Text("${event.event_date ?: "Date TBD"} • ${event.location ?: "Venue TBD"}")
                Spacer(modifier = Modifier.height(12.dp))
                Button(onClick = { portalViewModel.registerEvent(event.id) }) { Text("Register") }
            }
        }
    }
}

@Composable
fun StudentClubsScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Student Clubs") { snapshot ->
    snapshot.student?.clubs.orEmpty().forEach { club ->
        SectionCard(title = club.name, subtitle = club.category) {
            Text(club.description ?: "No description")
            Spacer(modifier = Modifier.height(8.dp))
            Text("Members: ${club.members ?: 0} • Events: ${club.events ?: 0}")
            Spacer(modifier = Modifier.height(12.dp))
            if (club.joined) {
                Button(onClick = { portalViewModel.leaveClub(club.id) }) { Text("Leave club") }
            } else {
                Button(onClick = { portalViewModel.joinClub(club.id) }) { Text("Join club") }
            }
        }
    }
}

@Composable
fun StudentHostelMenuScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Hostel Menu") { snapshot ->
    snapshot.student?.hostelMenu.orEmpty().groupBy { it.meal_type }.forEach { (mealType, items) ->
        SectionCard(title = mealType.replaceFirstChar(Char::titlecase)) {
            items.forEach { item -> Text("${item.date}: ${item.menu_items}") }
        }
    }
}

@Composable
fun StudentForumScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Student Forum") { snapshot ->
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("General") }
    SectionCard(title = "Ask a question") {
        OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Category") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(12.dp))
        Button(onClick = { portalViewModel.createForumQuestion(title, description, category) }) { Text("Post question") }
    }
    snapshot.student?.forum.orEmpty().forEach { question ->
        var answer by remember(question.id) { mutableStateOf("") }
        SectionCard(title = question.title, subtitle = "${question.author_name ?: "Unknown"} • ${question.category ?: "General"}") {
            Text(question.description)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = answer, onValueChange = { answer = it }, label = { Text("Answer") }, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = { portalViewModel.answerForumQuestion(question.id, answer) }) { Text("Post answer") }
        }
    }
}

@Composable
fun StudentAiAssistantScreen(portalViewModel: PortalViewModel) {
    val messages by portalViewModel.messages.collectAsStateWithLifecycle()
    var prompt by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("AI assistant", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        OutlinedTextField(value = prompt, onValueChange = { prompt = it }, label = { Text("Ask something") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = {
            portalViewModel.sendAiMessage(prompt)
            prompt = ""
        }) {
            Text("Send")
        }
        if (messages.isEmpty()) {
            Text("Backend-backed AI chat is wired. Ask for study plans, explanations, or guidance.")
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f, fill = true),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(messages) { message ->
                    SectionCard(title = message.role.replaceFirstChar(Char::titlecase)) {
                        Text(message.content)
                    }
                }
            }
        }
    }
}

@Composable
fun StudentPaymentHistoryScreen(portalViewModel: PortalViewModel, onOpenPayment: (String) -> Unit) =
    SnapshotScreen(portalViewModel, "Payment History") { snapshot ->
        val payments = snapshot.student?.payments.orEmpty()
        if (payments.isEmpty()) {
            EmptyState("No payments", "Payment history will appear here when the backend returns records.")
        } else {
            payments.forEach { payment ->
                SectionCard(title = payment.paymentId, subtitle = payment.status) {
                    Text("₹${payment.amount} • ${payment.category} • Semester ${payment.semester}")
                    Spacer(modifier = Modifier.height(12.dp))
                    ActionButtons(primaryLabel = "Open", onPrimary = { onOpenPayment(payment.id) })
                }
            }
        }
    }

@Composable
fun StudentPaymentDetailScreen(portalViewModel: PortalViewModel, paymentId: String) =
    SnapshotScreen(portalViewModel, "Payment Details") { snapshot ->
        val payment = snapshot.student?.payments.orEmpty().firstOrNull { it.id == paymentId }
        if (payment == null) {
            EmptyState("Payment not found", "No payment with id $paymentId exists in the current snapshot.")
        } else {
            SectionCard(title = payment.paymentId, subtitle = payment.status) {
                Text("Amount: ₹${payment.amount}")
                Text("Transaction: ${payment.transactionId ?: "Pending"}")
                Text("Date: ${payment.paymentDate ?: "N/A"}")
                Text("Description: ${payment.description ?: "N/A"}")
                Spacer(modifier = Modifier.height(12.dp))
                Button(onClick = {
                    portalViewModel.downloadReceipt(payment.id, "${payment.paymentId}.pdf") {
                        portalViewModel.openCachedFile(it)
                    }
                }) {
                    Text("Open receipt")
                }
            }
        }
    }

@Composable
fun StudentPaymentMakeScreen(portalViewModel: PortalViewModel) {
    val actionBusy by portalViewModel.actionBusy.collectAsStateWithLifecycle()
    var amount by remember { mutableStateOf("1000") }
    var semester by remember { mutableStateOf("1") }
    var category by remember { mutableStateOf("tuition") }
    var paymentMethod by remember { mutableStateOf("upi") }
    var description by remember { mutableStateOf("Native Android payment flow") }
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Make Payment", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Amount") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = semester, onValueChange = { semester = it }, label = { Text("Semester") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Category") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = paymentMethod, onValueChange = { paymentMethod = it }, label = { Text("Payment method") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
        Button(enabled = amount.toDoubleOrNull() != null && semester.isNotBlank() && category.isNotBlank() && paymentMethod.isNotBlank() && !actionBusy, onClick = {
            portalViewModel.createPayment(
                CreatePaymentRequest(
                    amount = amount.toDoubleOrNull() ?: 0.0,
                    semester = semester,
                    category = category,
                    paymentMethod = paymentMethod,
                    description = description
                )
            )
        }) {
            Text(if (actionBusy) "Submitting…" else "Submit payment")
        }
    }
}

@Composable
fun TeacherAttendanceScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Teacher Attendance") { snapshot ->
    val actionBusy by portalViewModel.actionBusy.collectAsStateWithLifecycle()
    val students = snapshot.teacher?.students.orEmpty()
    var subject by rememberSaveable { mutableStateOf(snapshot.shared.subjects.firstOrNull()?.name ?: "General") }
    var date by rememberSaveable { mutableStateOf(java.time.LocalDate.now().toString()) }
    SectionCard(title = "Attendance context") {
        OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Subject") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = date, onValueChange = { date = it }, label = { Text("Date (YYYY-MM-DD)") }, modifier = Modifier.fillMaxWidth())
    }
    students.forEach { student ->
        SectionCard(title = student.name, subtitle = student.registration_number) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = {
                    portalViewModel.markAttendance(
                        MarkAttendanceRequest(
                            student_id = student.id,
                            subject = subject,
                            date = date,
                            status = "present"
                        )
                    )
                }, enabled = subject.isNotBlank() && date.isNotBlank() && !actionBusy) { Text("Present") }
                OutlinedButton(onClick = {
                    portalViewModel.markAttendance(
                        MarkAttendanceRequest(
                            student_id = student.id,
                            subject = subject,
                            date = date,
                            status = "absent"
                        )
                    )
                }, enabled = subject.isNotBlank() && date.isNotBlank() && !actionBusy) { Text("Absent") }
            }
        }
    }
}

@Composable
fun TeacherMarksScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Teacher Marks") { snapshot ->
    val actionBusy by portalViewModel.actionBusy.collectAsStateWithLifecycle()
    val students = snapshot.teacher?.students.orEmpty()
    var selectedStudentId by rememberSaveable { mutableStateOf(students.firstOrNull()?.id.orEmpty()) }
    var selectedStudentLabel by rememberSaveable { mutableStateOf(students.firstOrNull()?.registration_number.orEmpty()) }
    var subject by rememberSaveable { mutableStateOf(snapshot.shared.subjects.firstOrNull()?.name ?: "General") }
    var examType by rememberSaveable { mutableStateOf("mid-semester") }
    var marks by rememberSaveable { mutableStateOf("85") }
    var totalMarks by rememberSaveable { mutableStateOf("100") }
    var examDate by rememberSaveable { mutableStateOf(java.time.LocalDate.now().toString()) }
    var remarks by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(students) {
        if (selectedStudentId.isBlank() && students.isNotEmpty()) {
            selectedStudentId = students.first().id
            selectedStudentLabel = students.first().registration_number
        }
    }
    SectionCard(title = "Upload marks", subtitle = "Select a student and enter the actual assessment details") {
        if (students.isEmpty()) {
            Text("No students are available in the teacher roster snapshot.")
            return@SectionCard
        }
        Text("Quick pick")
        Spacer(modifier = Modifier.height(8.dp))
        students.take(6).forEach { student ->
            TextButton(onClick = {
                selectedStudentId = student.id
                selectedStudentLabel = "${student.name} (${student.registration_number})"
            }) {
                Text("${student.name} • ${student.registration_number}")
            }
        }
        OutlinedTextField(
            value = selectedStudentId,
            onValueChange = { selectedStudentId = it },
            label = { Text("Student ID") },
            supportingText = { Text(selectedStudentLabel.ifBlank { "Select a roster entry or paste a user id" }) },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Subject") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = examType, onValueChange = { examType = it }, label = { Text("Exam type") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = marks, onValueChange = { marks = it }, label = { Text("Marks obtained") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = totalMarks, onValueChange = { totalMarks = it }, label = { Text("Total marks") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = examDate, onValueChange = { examDate = it }, label = { Text("Exam date (YYYY-MM-DD)") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = remarks, onValueChange = { remarks = it }, label = { Text("Remarks") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(12.dp))
        Button(
            enabled = selectedStudentId.isNotBlank() &&
                subject.isNotBlank() &&
                examType.isNotBlank() &&
                marks.toDoubleOrNull() != null &&
                totalMarks.toDoubleOrNull() != null &&
                examDate.isNotBlank() &&
                !actionBusy,
            onClick = {
                portalViewModel.uploadMarks(
                    UploadMarksRequest(
                        student_id = selectedStudentId,
                        subject = subject,
                        exam_type = examType,
                        marks_obtained = marks.toDoubleOrNull() ?: 0.0,
                        total_marks = totalMarks.toDoubleOrNull() ?: 0.0,
                        exam_date = examDate,
                        remarks = remarks.takeIf { it.isNotBlank() }
                    )
                )
            }
        ) { Text(if (actionBusy) "Submitting…" else "Submit") }
    }
}

@Composable
fun TeacherAssignmentsScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Teacher Assignments") { snapshot ->
    val actionBusy by portalViewModel.actionBusy.collectAsStateWithLifecycle()
    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var subject by rememberSaveable { mutableStateOf(snapshot.shared.subjects.firstOrNull()?.name ?: "General") }
    var department by rememberSaveable { mutableStateOf(snapshot.user.department ?: "CSE") }
    var year by rememberSaveable { mutableStateOf((snapshot.user.year ?: 1).toString()) }
    var totalMarks by rememberSaveable { mutableStateOf("100") }
    var deadline by rememberSaveable { mutableStateOf(java.time.LocalDate.now().plusDays(7).toString()) }
    SectionCard(title = "Create assignment") {
        OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Subject") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = department, onValueChange = { department = it }, label = { Text("Department") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = year, onValueChange = { year = it }, label = { Text("Year") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = totalMarks, onValueChange = { totalMarks = it }, label = { Text("Total marks") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = deadline, onValueChange = { deadline = it }, label = { Text("Deadline (YYYY-MM-DD)") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(12.dp))
        Button(onClick = {
            portalViewModel.createAssignment(
                CreateAssignmentRequest(
                    title = title,
                    description = description,
                    subject = subject,
                    department = department,
                    year = year.toIntOrNull() ?: 1,
                    total_marks = totalMarks.toDoubleOrNull() ?: 0.0,
                    deadline = deadline
                )
            )
        }, enabled = title.isNotBlank() && description.isNotBlank() && subject.isNotBlank() && department.isNotBlank() && year.toIntOrNull() != null && totalMarks.toDoubleOrNull() != null && deadline.isNotBlank() && !actionBusy) {
            Text(if (actionBusy) "Creating…" else "Create")
        }
    }
    snapshot.teacher?.assignments.orEmpty().forEach { assignment ->
        SectionCard(title = assignment.title, subtitle = assignment.subject) {
            Text(assignment.description ?: "No description")
            Text("Deadline: ${assignment.deadline ?: "TBD"}")
        }
    }
}

@Composable
fun TeacherNotesScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Teacher Notes") { snapshot ->
    val actionBusy by portalViewModel.actionBusy.collectAsStateWithLifecycle()
    var fileUri by remember { mutableStateOf<Uri?>(null) }
    var title by rememberSaveable { mutableStateOf("") }
    var subject by rememberSaveable { mutableStateOf(snapshot.shared.subjects.firstOrNull()?.name ?: "General") }
    var semester by rememberSaveable { mutableStateOf(snapshot.user.semester ?: "1") }
    var description by rememberSaveable { mutableStateOf("") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> fileUri = uri }
    LaunchedEffect(fileUri) {
        if (fileUri != null && title.isBlank()) {
            title = fileUri?.lastPathSegment?.substringAfterLast('/')?.substringBeforeLast('.') ?: "Android note"
        }
    }
    SectionCard(title = "Upload study material") {
        Button(onClick = { picker.launch(arrayOf("*/*")) }) { Text("Select note") }
        fileUri?.let { uri ->
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title") }, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Subject") }, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = semester, onValueChange = { semester = it }, label = { Text("Semester") }, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(12.dp))
            Button(enabled = title.isNotBlank() && subject.isNotBlank() && semester.isNotBlank() && !actionBusy, onClick = {
                portalViewModel.uploadNote(
                    fileUri = uri,
                    fileName = uri.lastPathSegment?.substringAfterLast('/') ?: "note",
                    title = title,
                    subject = subject,
                    branch = snapshot.user.department ?: "CSE",
                    semester = semester,
                    description = description.takeIf { it.isNotBlank() }
                )
            }) { Text(if (actionBusy) "Uploading…" else "Upload") }
        }
    }
    snapshot.teacher?.notes.orEmpty().forEach { note ->
        SectionCard(title = note.title, subtitle = note.subject ?: note.type) {
            Text(note.description ?: "No description")
        }
    }
}

@Composable
fun TeacherQuestionBankScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Teacher Question Bank") { snapshot ->
    val actionBusy by portalViewModel.actionBusy.collectAsStateWithLifecycle()
    var editingQuestionId by rememberSaveable { mutableStateOf<String?>(null) }
    var question by rememberSaveable { mutableStateOf("") }
    var subjectId by rememberSaveable { mutableStateOf((snapshot.shared.subjects.firstOrNull()?.id ?: 1).toString()) }
    var questionType by rememberSaveable { mutableStateOf("mcq") }
    var difficulty by rememberSaveable { mutableStateOf("medium") }
    var topic by rememberSaveable { mutableStateOf("") }
    var marks by rememberSaveable { mutableStateOf("1") }
    SectionCard(title = if (editingQuestionId == null) "Add question" else "Edit question") {
        OutlinedTextField(value = question, onValueChange = { question = it }, label = { Text("Question text") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = subjectId, onValueChange = { subjectId = it }, label = { Text("Subject ID") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = questionType, onValueChange = { questionType = it }, label = { Text("Question type") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = difficulty, onValueChange = { difficulty = it }, label = { Text("Difficulty") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = topic, onValueChange = { topic = it }, label = { Text("Topic") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = marks, onValueChange = { marks = it }, label = { Text("Marks") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(12.dp))
        Button(
            enabled = question.isNotBlank() && subjectId.toIntOrNull() != null && marks.toIntOrNull() != null && !actionBusy,
            onClick = {
                val request = CreateQuestionRequest(
                    subject_id = subjectId.toIntOrNull() ?: 1,
                    question_text = question,
                    difficulty = difficulty.ifBlank { "medium" },
                    question_type = questionType.ifBlank { "mcq" },
                    topic = topic.takeIf { it.isNotBlank() },
                    marks = marks.toIntOrNull() ?: 1
                )
                editingQuestionId?.let { portalViewModel.updateQuestion(it, request) } ?: portalViewModel.createQuestion(request)
            }
        ) { Text(if (actionBusy) "Saving…" else if (editingQuestionId == null) "Save question" else "Update question") }
        if (editingQuestionId != null) {
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(onClick = {
                editingQuestionId = null
                question = ""
                subjectId = (snapshot.shared.subjects.firstOrNull()?.id ?: 1).toString()
                questionType = "mcq"
                difficulty = "medium"
                topic = ""
                marks = "1"
            }) {
                Text("Clear selection")
            }
        }
    }
    snapshot.teacher?.questionBank.orEmpty().forEach { item ->
        SectionCard(title = item.question_text, subtitle = item.difficulty) {
            Text("Type: ${item.question_type}")
            Text("Topic: ${item.topic ?: "N/A"}")
            Text("Marks: ${item.marks ?: 1}")
            Spacer(modifier = Modifier.height(12.dp))
            ActionButtons(
                primaryLabel = "Edit",
                onPrimary = {
                    editingQuestionId = item.id
                    question = item.question_text
                    subjectId = (item.subject_id ?: 1).toString()
                    questionType = item.question_type
                    difficulty = item.difficulty
                    topic = item.topic.orEmpty()
                    marks = (item.marks ?: 1).toString()
                },
                secondaryLabel = "Delete",
                onSecondary = { portalViewModel.deleteQuestion(item.id) }
            )
        }
    }
}

@Composable
fun TeacherRubricsScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Teacher Rubrics") { snapshot ->
    val actionBusy by portalViewModel.actionBusy.collectAsStateWithLifecycle()
    var name by rememberSaveable { mutableStateOf("Android rubric") }
    var assignmentId by rememberSaveable { mutableStateOf(snapshot.teacher?.assignments?.firstOrNull()?.id ?: "1") }
    var criteria by remember {
        mutableStateOf(
            listOf(
                CriterionDraft(name = "Correctness", description = "Covers expected answer", maxPoints = "10"),
                CriterionDraft(name = "Clarity", description = "Clear and well structured", maxPoints = "5")
            )
        )
    }
    SectionCard(title = "Create rubric") {
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Rubric name") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = assignmentId, onValueChange = { assignmentId = it }, label = { Text("Assignment ID") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        criteria.forEachIndexed { index, criterion ->
            OutlinedTextField(
                value = criterion.name,
                onValueChange = { value ->
                    criteria = criteria.toMutableList().also { it[index] = it[index].copy(name = value) }
                },
                label = { Text("Criterion ${index + 1} name") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = criterion.description,
                onValueChange = { value ->
                    criteria = criteria.toMutableList().also { it[index] = it[index].copy(description = value) }
                },
                label = { Text("Criterion ${index + 1} description") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = criterion.maxPoints,
                onValueChange = { value ->
                    criteria = criteria.toMutableList().also { it[index] = it[index].copy(maxPoints = value) }
                },
                label = { Text("Criterion ${index + 1} max points") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth()
            )
            if (criteria.size > 1) {
                TextButton(onClick = {
                    criteria = criteria.toMutableList().also { it.removeAt(index) }
                }) {
                    Text("Remove criterion")
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
        TextButton(onClick = { criteria = criteria + CriterionDraft() }) {
            Text("Add criterion")
        }
        Spacer(modifier = Modifier.height(12.dp))
        Button(enabled = name.isNotBlank() && assignmentId.toIntOrNull() != null && criteria.any { it.name.isNotBlank() && it.maxPoints.toIntOrNull() != null } && !actionBusy, onClick = {
            portalViewModel.createRubric(
                CreateRubricRequest(
                    assignment_id = assignmentId.toIntOrNull() ?: 1,
                    name = name,
                    criteria = criteria
                        .filter { it.name.isNotBlank() && it.maxPoints.toIntOrNull() != null }
                        .map {
                            RubricCriterion(
                                name = it.name,
                                description = it.description.takeIf(String::isNotBlank),
                                max_points = it.maxPoints.toIntOrNull() ?: 0
                            )
                        }
                )
            )
        }) { Text(if (actionBusy) "Saving…" else "Save rubric") }
    }
    snapshot.teacher?.rubrics.orEmpty().forEach { rubric ->
        SectionCard(title = rubric.name, subtitle = "Assignment ${rubric.assignment_id ?: "-"}") {
            rubric.criteria.forEach { criterion ->
                Text("${criterion.name}: ${criterion.max_points} pts")
            }
        }
    }
}

@Composable
fun TeacherStudentsScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Teacher Students") { snapshot ->
    snapshot.teacher?.students.orEmpty().forEach { student ->
        SectionCard(title = student.name, subtitle = student.registration_number) {
            Text("Attendance: ${student.attendance_percent ?: 0.0}%")
            Text("Average marks: ${student.avg_marks ?: 0.0}")
        }
    }
}

@Composable
fun AdminUsersScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Admin Users") { snapshot ->
    snapshot.admin?.users.orEmpty().forEach { user ->
        SectionCard(title = user.name, subtitle = "${user.role} • ${user.department ?: "N/A"}") {
            Text(user.email ?: "No email")
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = { portalViewModel.toggleUserActive(user.id) }) {
                Text(if (user.is_active) "Deactivate" else "Activate")
            }
        }
    }
}

@Composable
fun AdminApprovalsScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Admin Approvals") { snapshot ->
    snapshot.admin?.approvals.orEmpty().forEach { approval ->
        SectionCard(title = approval.title, subtitle = approval.type) {
            Text("Uploaded by: ${approval.uploaded_by ?: "Unknown"}")
            Text("Department: ${approval.department ?: "N/A"}")
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = { portalViewModel.approveFile(approval.id) }) { Text("Approve") }
        }
    }
}

@Composable
fun AdminAnalyticsScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Admin Analytics") { snapshot ->
    SectionCard(title = "Analytics overview") {
        snapshot.admin?.analytics.orEmpty().chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { metric ->
                    MetricCard(metric.title, metric.value, metric.detail, Modifier.weight(1f))
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}

@Composable
fun AdminAnnouncementsScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Admin Announcements") { snapshot ->
    val actionBusy by portalViewModel.actionBusy.collectAsStateWithLifecycle()
    var title by rememberSaveable { mutableStateOf("") }
    var content by rememberSaveable { mutableStateOf("") }
    var priority by rememberSaveable { mutableStateOf("normal") }
    var targetAudience by rememberSaveable { mutableStateOf("all") }
    var department by rememberSaveable { mutableStateOf(snapshot.user.department.orEmpty()) }
    SectionCard(title = "Create announcement") {
        OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = content, onValueChange = { content = it }, label = { Text("Content") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = priority, onValueChange = { priority = it }, label = { Text("Priority") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = targetAudience, onValueChange = { targetAudience = it }, label = { Text("Target audience") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = department, onValueChange = { department = it }, label = { Text("Department (optional)") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(12.dp))
        Button(enabled = title.isNotBlank() && content.isNotBlank() && priority.isNotBlank() && targetAudience.isNotBlank() && !actionBusy, onClick = {
            portalViewModel.createAnnouncement(
                CreateAnnouncementRequest(
                    title = title,
                    content = content,
                    priority = priority,
                    target_audience = targetAudience,
                    department = department.takeIf { it.isNotBlank() }
                )
            )
        }) { Text(if (actionBusy) "Publishing…" else "Publish") }
    }
    snapshot.admin?.announcements.orEmpty().forEach { announcement ->
        SectionCard(title = announcement.title, subtitle = announcement.priority) {
            Text(announcement.content)
        }
    }
}

@Composable
fun AdminDepartmentsScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Admin Departments") { snapshot ->
    snapshot.admin?.departments.orEmpty().forEach { department ->
        SectionCard(title = department.name, subtitle = department.code) {
            Text("HOD: ${department.hod ?: "N/A"}")
            Text("Students: ${department.total_students}")
            Text("Teachers: ${department.total_teachers}")
            Text("Courses: ${department.active_courses}")
        }
    }
}

@Composable
fun AdminSettingsScreen(portalViewModel: PortalViewModel) = SnapshotScreen(portalViewModel, "Admin Settings") { snapshot ->
    var editableSettings by remember(snapshot.admin?.settings) { mutableStateOf(snapshot.admin?.settings.orEmpty()) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        editableSettings.forEachIndexed { index, setting ->
            OutlinedTextField(
                value = setting.value,
                onValueChange = { value ->
                    editableSettings = editableSettings.toMutableList().also {
                        it[index] = it[index].copy(value = value)
                    }
                },
                label = { Text(setting.key) },
                supportingText = { Text(setting.description ?: "") },
                modifier = Modifier.fillMaxWidth()
            )
        }
        Button(onClick = { portalViewModel.updateSettings(editableSettings) }) {
            Text("Save settings")
        }
    }
}

private data class CriterionDraft(
    val name: String = "",
    val description: String = "",
    val maxPoints: String = "5"
)

private fun JsonElement?.displayText(): String? {
    val raw = this?.toString()
        ?.removePrefix("\"")
        ?.removeSuffix("\"")
        ?.takeIf { it.isNotBlank() && it != "null" }
    return raw
}

@Composable
private fun SnapshotScreen(
    portalViewModel: PortalViewModel,
    title: String,
    content: @Composable ColumnScope.(MobileSnapshot) -> Unit
) {
    val snapshotState by portalViewModel.snapshotState.collectAsStateWithLifecycle()
    when (val state = snapshotState) {
        UiState.Idle, UiState.Loading -> LoadingState()
        is UiState.Error -> ErrorState(state.message, portalViewModel::loadSnapshot)
        is UiState.Success -> {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Text(text = title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        content(state.value)
                    }
                }
            }
        }
    }
}

@Composable
private fun ListRow(
    title: String,
    subtitle: String? = null,
    trailing: String? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, style = MaterialTheme.typography.bodySmall)
            }
        }
        if (!trailing.isNullOrBlank()) {
            Text(trailing, style = MaterialTheme.typography.bodySmall)
        }
        if (actionLabel != null && onAction != null) {
            Spacer(modifier = Modifier.width(8.dp))
            TextButton(onClick = onAction) { Text(actionLabel) }
        }
    }
}
