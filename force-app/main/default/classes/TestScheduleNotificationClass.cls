@IsTest
public class TestScheduleNotificationClass {
    
    @IsTest
    static void testSendCustomNotification_Success() {
        // Create test users for approvers
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User'];
        User testUser1 = new User(
            FirstName = 'Test',
            LastName = 'User1',
            Email = 'testuser1@test.com',
            Username = 'testuser1' + DateTime.now().getTime() + '@test.com',
            Alias = 'tuser1',
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            ProfileId = p.Id,
            LanguageLocaleKey = 'en_US'
        );
        insert testUser1;
        
        // Create a test account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        Test.startTest();
        
        ScheduleNotificationClass.NotificationRequest request = new ScheduleNotificationClass.NotificationRequest();
        request.recordId = testAccount.Id;
        request.content = 'Test notification content';
        
        ScheduleNotificationClass.sendCustomNotification(new List<ScheduleNotificationClass.NotificationRequest>{request});
        
        Test.stopTest();
    }
    
    @IsTest
    static void testSendCustomNotification_MultipleRecords() {
        // Create test users
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User'];
        User testUser = new User(
            FirstName = 'Test',
            LastName = 'User',
            Email = 'testuser@test.com',
            Username = 'testuser' + DateTime.now().getTime() + '@test.com',
            Alias = 'tuser',
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            ProfileId = p.Id,
            LanguageLocaleKey = 'en_US'
        );
        insert testUser;
        
        // Create multiple test accounts
        List<Account> testAccounts = new List<Account>();
        for(Integer i = 0; i < 3; i++) {
            testAccounts.add(new Account(Name = 'Test Account ' + i));
        }
        insert testAccounts;
        
        Test.startTest();
        
        List<ScheduleNotificationClass.NotificationRequest> requests = new List<ScheduleNotificationClass.NotificationRequest>();
        for(Account acc : testAccounts) {
            ScheduleNotificationClass.NotificationRequest request = new ScheduleNotificationClass.NotificationRequest();
            request.recordId = acc.Id;
            request.content = 'Notification for ' + acc.Name;
            requests.add(request);
        }
        
        ScheduleNotificationClass.sendCustomNotification(requests);
        
        Test.stopTest();
        
    }
    
    @IsTest
    static void testNotificationRequestClass() {
        ScheduleNotificationClass.NotificationRequest request = new ScheduleNotificationClass.NotificationRequest();
        request.recordId = '001000000000001AAA';
        request.content = 'Test content';
        
        System.assertEquals('001000000000001AAA', request.recordId, 'Record Id should match');
        System.assertEquals('Test content', request.content, 'Content should match');
    }
    
    @IsTest
    static void testEmptyRequestList() {
        Test.startTest();
        ScheduleNotificationClass.sendCustomNotification(new List<ScheduleNotificationClass.NotificationRequest>());
        Test.stopTest();
    }
}