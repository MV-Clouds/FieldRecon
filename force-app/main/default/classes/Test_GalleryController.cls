@isTest
public class Test_GalleryController {
    @isTest
    public static void galleryMethod1() {
        GalleryController gc = new GalleryController();

        Job__c j = new Job__c();
        j.Job_Name__c = 'test job';
        j.Status__c = 'Active';

        insert j;

        ContentVersion contV = new ContentVersion();
        contV.Title = 'Test Mvclouds Document';
        contV.PathOnClient = 'test1.pdf';

        contV.VersionData = Blob.valueOf('Test Data');
        contV.IsMajorVersion = true;

        insert contV;

        List<ContentVersion> contVList = [SELECT Id, Title, ContentDocumentId FROM ContentVersion WHERE Id = :contV.Id];

        List<ContentDocument> contDocu = [SELECT Id, Title, LatestPublishedVersionId FROM ContentDocument];

        ContentDocumentLink contentLink = new ContentDocumentLink();
        contentLink.LinkedEntityId = j.Id;
        contentLink.ContentDocumentId = contDocu[0].id;
        contentLink.ShareType = 'V';

        insert contentLink;

        FeedItem feed = new FeedItem();
        feed.parentid = j.id;
        feed.type = 'ContentPost';
        feed.RelatedRecordId = contV.id;
        feed.Body = contentLink.ContentDocumentId;

        insert feed;

        Test.startTest();
        System.assertEquals(contDocu.size(), 1);
        GalleryController.getContents(j.id);
        Test.stopTest();
    }
}