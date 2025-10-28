@isTest
public class TimeLogWeeklyControllerTest {
    @isTest
    public static void timeWeektest() {
        TestDataFactory.UserData();
        System.runAs(TestDataFactory.userList[0]) {
            Test.startTest();

            // Document dc = new Document();
            // dc.Body = Blob.valueOf('Some Text');
            // dc.ContentType = 'application/pdf';
            // dc.DeveloperName = 'my_document';
            // dc.IsPublic = true;
            // dc.Name = 'My Document';
            // dc.FolderId = [SELECT id FROM folder LIMIT 1].id;
            // insert dc;

            PageReference pageRef = Page.TimesheetWeeklyPage;
            Test.setCurrentPage(pageRef); // Add your VF page Name here
            ApexPages.currentPage().getParameters().put('pageId', '');
            ApexPages.currentPage().getParameters().put('StartDate', String.valueof(System.today()));
            ApexPages.currentPage().getParameters().put('EndDate', String.valueof(System.today().addDays(9)));
            // System.assert(dc.Id != null, 'document id is not null');
            TimeLogWeeklyController tlwc = new TimeLogWeeklyController();
            Test.stopTest();
            Assert.areEqual(tlwc != NULL, TRUE);
        }
    }
}