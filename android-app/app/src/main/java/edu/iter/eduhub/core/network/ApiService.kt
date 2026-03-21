package edu.iter.eduhub.core.network

import edu.iter.eduhub.core.model.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming
import retrofit2.http.Url

interface ApiService {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): ApiResponse<LoginPayload>

    @POST("api/auth/register-student")
    suspend fun register(@Body request: RegistrationRequest): ApiResponse<LoginPayload>

    @GET("api/mobile/public")
    suspend fun getPublicContent(): ApiResponse<PublicContent>

    @GET("api/mobile/snapshot")
    suspend fun getSnapshot(@Header("Authorization") authorization: String): ApiResponse<MobileSnapshot>

    @GET("api/portal/status")
    suspend fun getPortalStatus(@Header("Authorization") authorization: String? = null): ApiResponse<PortalStatusPayload>

    @GET("api/portal/data")
    suspend fun getPortalData(@Header("Authorization") authorization: String): ApiResponse<PortalDataPayload>

    @POST("api/portal/login")
    suspend fun connectPortal(
        @Header("Authorization") authorization: String? = null,
        @Body request: PortalCredentialsRequest
    ): ApiResponse<PortalDataPayload>

    @GET("api/portal/recover")
    suspend fun recoverPortalData(
        @Header("Authorization") authorization: String? = null,
        @Query("reg_number") regNumber: String? = null
    ): ApiResponse<PortalDataPayload>

    @POST("api/portal/load-backup")
    suspend fun loadPortalBackup(
        @Header("Authorization") authorization: String? = null,
        @Body request: PortalLookupRequest
    ): ApiResponse<PortalDataPayload>

    @GET("api/portal/demo")
    suspend fun loadPortalDemo(): ApiResponse<PortalDataPayload>

    @POST("api/portal/disconnect")
    suspend fun disconnectPortal(@Header("Authorization") authorization: String): ApiResponse<Unit>

    @GET("api/notifications")
    suspend fun getNotifications(@Header("Authorization") authorization: String): NotificationListResponse

    @PUT("api/notifications/{id}/read")
    suspend fun markNotificationRead(
        @Header("Authorization") authorization: String,
        @Path("id") id: String
    ): ApiResponse<Unit>

    @GET("api/search")
    suspend fun search(
        @Header("Authorization") authorization: String,
        @Query("q") query: String
    ): SearchResponse

    @POST("api/events/{id}/register")
    suspend fun registerEvent(
        @Header("Authorization") authorization: String,
        @Path("id") eventId: String
    ): ApiResponse<Unit>

    @POST("api/clubs/{id}/join")
    suspend fun joinClub(
        @Header("Authorization") authorization: String,
        @Path("id") clubId: String
    ): ApiResponse<Unit>

    @POST("api/clubs/{id}/leave")
    suspend fun leaveClub(
        @Header("Authorization") authorization: String,
        @Path("id") clubId: String
    ): ApiResponse<Unit>

    @POST("api/payments")
    suspend fun createPayment(
        @Header("Authorization") authorization: String,
        @Body request: CreatePaymentRequest
    ): ApiResponse<PaymentItem>

    @GET("api/payments/{id}/receipt")
    @Streaming
    suspend fun downloadReceipt(
        @Header("Authorization") authorization: String,
        @Path("id") paymentId: String
    ): Response<ResponseBody>

    @GET("api/files/download/{id}")
    @Streaming
    suspend fun downloadFile(
        @Header("Authorization") authorization: String,
        @Path("id") fileId: String
    ): Response<ResponseBody>

    @GET
    @Streaming
    suspend fun downloadFromUrl(
        @Url url: String,
        @Header("Authorization") authorization: String
    ): Response<ResponseBody>

    @Multipart
    @POST("api/files/upload")
    suspend fun uploadFile(
        @Header("Authorization") authorization: String,
        @Part file: MultipartBody.Part,
        @Part("category") category: RequestBody,
        @Part("subject") subject: RequestBody?,
        @Part("description") description: RequestBody?
    ): ApiResponse<DocumentItem>

    @Multipart
    @POST("api/notes/upload")
    suspend fun uploadNote(
        @Header("Authorization") authorization: String,
        @Part file: MultipartBody.Part,
        @Part("title") title: RequestBody,
        @Part("subject") subject: RequestBody,
        @Part("branch") branch: RequestBody,
        @Part("semester") semester: RequestBody,
        @Part("description") description: RequestBody?
    ): ApiResponse<DocumentItem>

    @POST("api/attendance/mark")
    suspend fun markAttendance(
        @Header("Authorization") authorization: String,
        @Body request: MarkAttendanceRequest
    ): ApiResponse<Unit>

    @POST("api/marks/upload")
    suspend fun uploadMarks(
        @Header("Authorization") authorization: String,
        @Body request: UploadMarksRequest
    ): ApiResponse<Unit>

    @POST("api/assignments")
    suspend fun createAssignment(
        @Header("Authorization") authorization: String,
        @Body request: CreateAssignmentRequest
    ): ApiResponse<Unit>

    @POST("api/question-bank")
    suspend fun createQuestion(
        @Header("Authorization") authorization: String,
        @Body request: CreateQuestionRequest
    ): ApiResponse<Unit>

    @PUT("api/question-bank/{id}")
    suspend fun updateQuestion(
        @Header("Authorization") authorization: String,
        @Path("id") questionId: String,
        @Body request: CreateQuestionRequest
    ): ApiResponse<Unit>

    @DELETE("api/question-bank/{id}")
    suspend fun deleteQuestion(
        @Header("Authorization") authorization: String,
        @Path("id") questionId: String
    ): ApiResponse<Unit>

    @POST("api/rubrics")
    suspend fun createRubric(
        @Header("Authorization") authorization: String,
        @Body request: CreateRubricRequest
    ): ApiResponse<Unit>

    @POST("api/forum/questions")
    suspend fun createForumQuestion(
        @Header("Authorization") authorization: String,
        @Body request: Map<String, String>
    ): ApiResponse<Unit>

    @POST("api/forum/questions/{id}/answers")
    suspend fun answerForumQuestion(
        @Header("Authorization") authorization: String,
        @Path("id") questionId: String,
        @Body request: Map<String, String>
    ): ApiResponse<Unit>

    @POST("api/ai/chat")
    suspend fun chatWithAi(
        @Header("Authorization") authorization: String?,
        @Body request: AiChatRequest
    ): ApiResponse<AiChatMessage>

    @POST("api/admin/announcements")
    suspend fun createAnnouncement(
        @Header("Authorization") authorization: String,
        @Body request: CreateAnnouncementRequest
    ): ApiResponse<Unit>

    @GET("api/admin/settings")
    suspend fun getSettings(@Header("Authorization") authorization: String): ApiResponse<List<SettingItem>>

    @PUT("api/admin/settings")
    suspend fun updateSettings(
        @Header("Authorization") authorization: String,
        @Body request: UpdateSettingsRequest
    ): ApiResponse<Unit>

    @PUT("api/admin/users/{id}/toggle-active")
    suspend fun toggleUserActive(
        @Header("Authorization") authorization: String,
        @Path("id") userId: String
    ): ApiResponse<Unit>

    @POST("api/files/approve/{id}")
    suspend fun approveFile(
        @Header("Authorization") authorization: String,
        @Path("id") fileId: String
    ): ApiResponse<Unit>
}
