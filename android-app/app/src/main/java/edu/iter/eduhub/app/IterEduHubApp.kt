package edu.iter.eduhub.app

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import edu.iter.eduhub.app.navigation.AppDestinations
import edu.iter.eduhub.app.navigation.DrawerDestinations
import edu.iter.eduhub.core.model.AppSession
import edu.iter.eduhub.core.model.UserRole
import edu.iter.eduhub.core.ui.ErrorState
import edu.iter.eduhub.feature.auth.AuthScreen
import edu.iter.eduhub.feature.auth.AuthViewModel
import edu.iter.eduhub.feature.main.*
import kotlinx.coroutines.launch

@Composable
fun IterEduHubApp(
    application: EduHubApplication,
    initialRoute: String? = null
) {
    val navController = rememberNavController()
    val portalViewModel: PortalViewModel = viewModel(factory = appViewModelFactory {
        PortalViewModel(application.repository)
    })
    val authViewModel: AuthViewModel = viewModel(factory = appViewModelFactory {
        AuthViewModel(application.repository)
    })
    val session by portalViewModel.session.collectAsStateWithLifecycle()
    val toastMessage by portalViewModel.toastMessage.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val requestedRoute = rememberSaveable { mutableStateOf(initialRoute) }
    val currentRoute = navController.currentBackStackEntryAsState().value?.destination?.route
    val isAuthenticated = session != null

    LaunchedEffect(toastMessage) {
        toastMessage?.let {
            snackbarHostState.showSnackbar(it)
            portalViewModel.consumeToast()
        }
    }

    val showDrawer = isAuthenticated && currentRoute !in setOf(
        AppDestinations.Login,
        AppDestinations.Register,
        AppDestinations.Landing,
        AppDestinations.Creator
    )

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            if (showDrawer && session != null) {
                AppDrawer(
                    role = session!!.user.userRole,
                    currentRoute = currentRoute,
                    onNavigate = { route ->
                        navController.navigate(route) {
                            launchSingleTop = true
                        }
                    },
                    onSignOut = {
                        portalViewModel.signOut()
                        navController.navigate(AppDestinations.Login) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                inclusive = true
                            }
                        }
                    }
                )
            }
        }
    ) {
        Scaffold(
            topBar = {
                if (showDrawer && session != null) {
                    PortalTopBar(
                        title = currentRouteTitle(currentRoute),
                        onMenuClick = {
                            scope.launch {
                                if (drawerState.isClosed) drawerState.open() else drawerState.close()
                            }
                        }
                    )
                }
            },
            snackbarHost = { SnackbarHost(snackbarHostState) }
        ) { padding ->
            AppNavHost(
                navController = navController,
                modifier = Modifier.padding(padding),
                session = session,
                portalViewModel = portalViewModel,
                authViewModel = authViewModel,
                initialRoute = requestedRoute.value
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PortalTopBar(
    title: String,
    onMenuClick: () -> Unit
) {
    TopAppBar(
        title = { Text(title) },
        navigationIcon = {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, contentDescription = "Menu")
            }
        }
    )
}

@Composable
private fun AppDrawer(
    role: UserRole,
    currentRoute: String?,
    onNavigate: (String) -> Unit,
    onSignOut: () -> Unit
) {
    ModalDrawerSheet {
        Text(
            text = "ITER EduHub",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(20.dp)
        )
        DrawerDestinations
            .filter { role in it.roles }
            .forEach { destination ->
                NavigationDrawerItem(
                    label = { Text(destination.title) },
                    selected = currentRoute == destination.route,
                    onClick = { onNavigate(destination.route) },
                    icon = { Icon(destination.icon, contentDescription = destination.title) },
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                )
            }
        Divider(modifier = Modifier.padding(vertical = 8.dp))
        NavigationDrawerItem(
            label = { Text("Sign out") },
            selected = false,
            onClick = onSignOut,
            icon = { Icon(Icons.Default.ExitToApp, contentDescription = "Sign out") },
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun AppNavHost(
    navController: NavHostController,
    modifier: Modifier,
    session: AppSession?,
    portalViewModel: PortalViewModel,
    authViewModel: AuthViewModel,
    initialRoute: String?
) {
    val publicState = portalViewModel.publicState.collectAsStateWithLifecycle().value
    val startDestination = when {
        session == null && AppDestinations.isPublicRoute(initialRoute) -> initialRoute!!
        session == null && AppDestinations.isAuthenticatedRoute(initialRoute) -> AppDestinations.Login
        session != null && AppDestinations.isAllowed(initialRoute, session.user.userRole) -> initialRoute!!
        session != null -> AppDestinations.Dashboard
        else -> AppDestinations.Landing
    }
    NavHost(navController = navController, startDestination = startDestination, modifier = modifier) {
        composable(AppDestinations.Landing) {
            LandingScreen(
                publicState = publicState,
                onLogin = { navController.navigate(AppDestinations.Login) },
                onRegister = { navController.navigate(AppDestinations.Register) },
                onCreator = { navController.navigate(AppDestinations.Creator) },
                onConnectPortal = { navController.navigate(AppDestinations.ConnectPortal) }
            )
        }
        composable(AppDestinations.Creator) {
            CreatorScreen(publicState) { navController.popBackStack() }
        }
        composable(AppDestinations.ConnectPortal) {
            ConnectPortalScreen(
                publicState = publicState,
                portalViewModel = portalViewModel,
                session = session
            ) { navController.popBackStack() }
        }
        composable(AppDestinations.Login) {
            AuthScreen(
                authViewModel = authViewModel,
                onLoggedIn = { appSession ->
                    portalViewModel.onSignedIn(appSession)
                    val destination = initialRoute?.takeIf {
                        AppDestinations.isAllowed(it, appSession.user.userRole) && AppDestinations.isAuthenticatedRoute(it)
                    } ?: AppDestinations.Dashboard
                    navController.navigate(destination) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            inclusive = true
                        }
                    }
                },
                onRegister = { navController.navigate(AppDestinations.Register) }
            )
        }
        composable(AppDestinations.Register) {
            RegisterScreen(
                authViewModel = authViewModel,
                onBack = { navController.popBackStack() }
            )
        }
        composable(AppDestinations.Dashboard) {
            GuardedRoute(session, UserRole.entries.toSet()) {
                DashboardScreen(portalViewModel = portalViewModel, onNavigate = navController::navigate)
            }
        }
        composable(AppDestinations.Notifications) {
            GuardedRoute(session, UserRole.entries.toSet()) {
                NotificationsScreen(portalViewModel)
            }
        }
        composable(AppDestinations.Search) {
            GuardedRoute(session, UserRole.entries.toSet()) {
                SearchScreen(portalViewModel)
            }
        }
        composable(AppDestinations.Profile) {
            GuardedRoute(session, UserRole.entries.toSet()) {
                ProfileScreen(session = session, portalViewModel = portalViewModel)
            }
        }
        composable(AppDestinations.FileCenter) {
            GuardedRoute(session, UserRole.entries.toSet()) {
                FileCenterScreen(portalViewModel)
            }
        }
        composable(AppDestinations.StudentAttendance) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) { StudentAttendanceScreen(portalViewModel) }
        }
        composable(AppDestinations.StudentMarks) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) { StudentMarksScreen(portalViewModel) }
        }
        composable(AppDestinations.StudentTimetable) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) { StudentTimetableScreen(portalViewModel) }
        }
        composable(AppDestinations.StudentNotes) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) { StudentNotesScreen(portalViewModel) }
        }
        composable(AppDestinations.StudentAdmit) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) { StudentAdmitCardScreen(portalViewModel) }
        }
        composable(AppDestinations.StudentEvents) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) { StudentEventsScreen(portalViewModel) }
        }
        composable(AppDestinations.StudentClubs) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) { StudentClubsScreen(portalViewModel) }
        }
        composable(AppDestinations.StudentHostel) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) { StudentHostelMenuScreen(portalViewModel) }
        }
        composable(AppDestinations.StudentForum) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) { StudentForumScreen(portalViewModel) }
        }
        composable(AppDestinations.StudentAi) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) { StudentAiAssistantScreen(portalViewModel) }
        }
        composable(AppDestinations.StudentPaymentHistory) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) {
                StudentPaymentHistoryScreen(portalViewModel) { paymentId ->
                    navController.navigate("${AppDestinations.StudentPaymentDetail}/$paymentId")
                }
            }
        }
        composable("${AppDestinations.StudentPaymentDetail}/{paymentId}") { backStackEntry ->
            GuardedRoute(session, setOf(UserRole.STUDENT)) {
                StudentPaymentDetailScreen(
                    portalViewModel = portalViewModel,
                    paymentId = backStackEntry.arguments?.getString("paymentId").orEmpty()
                )
            }
        }
        composable(AppDestinations.StudentPaymentMake) {
            GuardedRoute(session, setOf(UserRole.STUDENT)) { StudentPaymentMakeScreen(portalViewModel) }
        }
        composable(AppDestinations.TeacherAttendance) {
            GuardedRoute(session, setOf(UserRole.TEACHER)) { TeacherAttendanceScreen(portalViewModel) }
        }
        composable(AppDestinations.TeacherMarks) {
            GuardedRoute(session, setOf(UserRole.TEACHER)) { TeacherMarksScreen(portalViewModel) }
        }
        composable(AppDestinations.TeacherAssignments) {
            GuardedRoute(session, setOf(UserRole.TEACHER)) { TeacherAssignmentsScreen(portalViewModel) }
        }
        composable(AppDestinations.TeacherNotes) {
            GuardedRoute(session, setOf(UserRole.TEACHER)) { TeacherNotesScreen(portalViewModel) }
        }
        composable(AppDestinations.TeacherQuestionBank) {
            GuardedRoute(session, setOf(UserRole.TEACHER)) { TeacherQuestionBankScreen(portalViewModel) }
        }
        composable(AppDestinations.TeacherRubrics) {
            GuardedRoute(session, setOf(UserRole.TEACHER)) { TeacherRubricsScreen(portalViewModel) }
        }
        composable(AppDestinations.TeacherStudents) {
            GuardedRoute(session, setOf(UserRole.TEACHER)) { TeacherStudentsScreen(portalViewModel) }
        }
        composable(AppDestinations.AdminUsers) {
            GuardedRoute(session, setOf(UserRole.ADMIN)) { AdminUsersScreen(portalViewModel) }
        }
        composable(AppDestinations.AdminApprovals) {
            GuardedRoute(session, setOf(UserRole.ADMIN)) { AdminApprovalsScreen(portalViewModel) }
        }
        composable(AppDestinations.AdminAnalytics) {
            GuardedRoute(session, setOf(UserRole.ADMIN)) { AdminAnalyticsScreen(portalViewModel) }
        }
        composable(AppDestinations.AdminAnnouncements) {
            GuardedRoute(session, setOf(UserRole.ADMIN)) { AdminAnnouncementsScreen(portalViewModel) }
        }
        composable(AppDestinations.AdminDepartments) {
            GuardedRoute(session, setOf(UserRole.ADMIN)) { AdminDepartmentsScreen(portalViewModel) }
        }
        composable(AppDestinations.AdminSettings) {
            GuardedRoute(session, setOf(UserRole.ADMIN)) { AdminSettingsScreen(portalViewModel) }
        }
    }
}

@Composable
private fun GuardedRoute(
    session: AppSession?,
    allowedRoles: Set<UserRole>,
    content: @Composable () -> Unit
) {
    when {
        session == null -> ErrorState("Please sign in to access this screen.")
        session.user.userRole !in allowedRoles -> ErrorState("This screen is not available for ${session.user.userRole.name.lowercase()} users.")
        else -> content()
    }
}

private fun currentRouteTitle(route: String?): String = when {
    route == null -> "ITER EduHub"
    route?.startsWith(AppDestinations.StudentPaymentDetail) == true -> "Payment Details"
    else -> DrawerDestinations.firstOrNull { it.route == route }?.title
        ?: when (route) {
            AppDestinations.Landing -> "Welcome"
            AppDestinations.Login -> "Login"
            AppDestinations.Register -> "Register"
            AppDestinations.Creator -> "Creator"
            AppDestinations.ConnectPortal -> "Connect Portal"
            else -> "ITER EduHub"
        }
}

private fun <T : ViewModel> appViewModelFactory(initializer: () -> T): ViewModelProvider.Factory =
    object : ViewModelProvider.Factory {
        override fun <VM : ViewModel> create(modelClass: Class<VM>): VM = initializer() as VM
    }
