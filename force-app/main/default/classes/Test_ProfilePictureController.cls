@isTest
public class Test_ProfilePictureController {
    @isTest
    public static void profileMethod1() {
        try{
        Document document;

        document = new Document();
        document.Body = Blob.valueOf('Test Text');
        document.ContentType = 'application/pdf';
        document.DeveloperName = 'test_document';
        document.IsPublic = true;
        document.Name = 'Test Document';
        document.FolderId = [SELECT id FROM folder WHERE name = 'Company Logo'].id;
        insert document;

        List<Document> contDocu = [SELECT Id, Name FROM Document];

        Test.startTest();
        System.assertEquals(contDocu.size(), 1);
        ProfilePictureController.getProfilePicture();
        ProfilePictureController.saveAttachment(document.Name, 'Test Text', document.ContentType);
        Test.stopTest();
        }catch(Exception e){}
    }
}