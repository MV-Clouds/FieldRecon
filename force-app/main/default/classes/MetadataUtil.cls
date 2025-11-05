public class MetadataUtil {
    public static MetadataService.MetadataPort createService() {
        MetadataService.MetadataPort service = new MetadataService.MetadataPort();
        service.SessionHeader = new MetadataService.SessionHeader_element();
        service.SessionHeader.sessionId = Page.UserSessionIdPage.getContent().toString();
        return service;
    }
}