@isTest
public class TestDataFactory {
    public static List<Account> accountList { get; set; }
    public static List<Contact> conList { get; set; }
    public static List<Job__c> jobList { get; set; }
    public static List<Mobilization__c> mobList { get; set; }
    public static List<Equipment__c> astList { get; set; }
    public static List<Mobilization_Asset__c> AssetList { get; set; }
    public static List<Mobilization_Member__c> memberList { get; set; }
    public static List<Mobilization_Member__c> memberList2 { get; set; }
    public static List<TimeSheet__c> TimesheetList { get; set; }
    public static List<Timesheet_Entry__c> TimesheetEntryList { get; set; }
    public static List<Expense__c> ExpenseList { get; set; }
    public static List<Timesheet_Entry_Item__c> timeEntryItem { get; set; }
    public static List<Cost_Code__c> costCodeList { get; set; }
    public static List<document> documentList { get; set; }
    public static List<Cost_Code__c> parentcostCodeList { get; set; }
    public static Contact currentUserContact { get; set; }

    public static List<User> userList { get; set; }
    public static List<Contact> contactList { get; set; }

    public static User createAdminUser() {
        Id profileId = [SELECT Id FROM Profile WHERE Name = 'System Administrator'].Id;
        User u = createUser(profileId);
        assignPermissionSet(u, new Set<String>{ 'WF_Recon_App_Admin' });
        return u;
    }

    public static void assignPermissionSet(User u, Set<String> permSetNames) {
        List<PermissionSetAssignment> psas = new List<PermissionSetAssignment>();
        List<PermissionSet> permissionSets = [SELECT Id FROM PermissionSet WHERE Name IN :permsetNames];
        for (PermissionSet perm : permissionSets) {
            psas.add(new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = perm.Id));
        }
        insert psas;
    }

    public static User createUser(Id profileId) {
        Integer randomNumber = Integer.valueof((Math.random() * 1000));
        String email = 'unit.test.user+' + randomNumber + '@test.com';

        User u = new User(
            FirstName = 'Test',
            LastName = 'User ',
            Email = email,
            Username = email,
            Alias = ('tuser' + randomNumber).right(8),
            Phone = '503-555-1212',
            ProfileId = profileId,
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'ISO-8859-1',
            LanguageLocaleKey = 'en_US'
        );
        insert u;

        return u;
    }

    public static void UserData() {
        userList = new List<User>();
        contactList = new List<Contact>();
        Profile pf = [SELECT Id FROM Profile WHERE Name = 'System Administrator'];
        for (Integer i = 0; i < 10; i++) {
            User u = new User();
            u.FirstName = 'test12';
            u.LastName = 'test12';
            u.AboutMe = 'Demo User';
            u.CompanyName = 'Patel Enterprise';
            u.Department = 'IT';
            u.EmployeeNumber = 'number';
            u.CommunityNickname = 'testmv' + i + i;
            u.email = 'chirag@gmail.com';
            u.Username = 'chiragrai@gmail.com' + i + i;
            u.Alias = 'test';
            u.Phone = '1234567898';
            u.TimeZoneSidKey = 'America/Los_Angeles';
            u.EmailEncodingKey = 'UTF-8';
            u.LanguageLocaleKey = 'en_US';
            u.LocaleSidKey = 'en_US';
            u.ProfileId = pf.Id;
            u.IsActive = true;
            u.Crew_User__c = true;
            userList.add(u);
        }

        insert userList;
        Id permissionSetId = [SELECT Id FROM PermissionSet WHERE Name = 'WF_Recon_App_Admin'].Id;
        List<PermissionSetAssignment> psas = new List<PermissionSetAssignment>();
        for (User u : userList) {
            psas.add(new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = permissionSetId));
        }
        insert psas;

        // for (Integer i = 0; i < 10; i++) {
        //     User user = userList[0];
        //     contactList.add(new Contact(LastName = user.LastName, firstName = user.firstName, User__c = user.Id));
        // }
        // insert contactList;
    }

    public static void createAccountData(Integer num) {
        accountList = new List<Account>();
        for (Integer i = 0; i < num; i++) {
            Account acc = new Account();
            acc.Name = 'Test';
            accountList.add(acc);
        }
        insert accountList;
    }

    public static void createPostalCode(Integer num) {
        parentcostCodeList = new List<Cost_Code__c>();
        for (Integer i = 0; i < 10; i++) {
            Cost_Code__c acc = new Cost_Code__c();
            acc.Default_Cost_Code__c = true;
            acc.Level_Code__c = 32;
            acc.Name = 'Test';
            parentcostCodeList.add(acc);
        }
        insert parentcostCodeList;
    }

    public static void CostCodedata(Integer num) {
        costCodeList = new List<Cost_Code__c>();
        for (Integer i = 0; i < 10; i++) {
            Cost_Code__c fcc = new Cost_Code__c();
            fcc.Name = 'Name';
            fcc.Default_Cost_Code__c = true;
            costCodeList.add(fcc);
        }
        insert costCodeList;
    }

    public static void jobdata(Integer num) {
        jobList = new List<Job__c>();
        for (Integer i = 0; i < num; i++) {
            Job__c job = new Job__c();
            job.Complete__c = 32;
            job.Actual_Man_Hours__c = 54;
            job.City__c = 'Ahmedabad';
            job.Geocode__latitude__s = 13.0429;
            job.Geocode__longitude__s = 80.2739;
            job.Completion_Date__c = System.today();
            job.Country__c = 'IN';
            job.County__c = 'Test';
            job.Description__c = 'testtest';
            job.FIPS_County__c = 'test';
            job.FIPS_State__c = 'State';
            job.Job_Address__c = 'test';
            job.Job_Name__c = 'Test';
            job.Need_Hotels__c = true;
            job.Per_Diem__c = true;
            job.QB_Customer_Id__c = 'test';
            job.Retainage__c = 54;
            job.State__c = 'test';
            job.Street__c = 'test';
            job.Sync_Token__c = 'test';
            job.Title__c = 'test';
            job.Total_Budgeted_Man_Hours__c = 45;
            job.Total_Budgeted_Material_Cost__c = 456;
            job.Total_Contract_Price__c = 544;
            job.Total_Job_Material_Expense__c = 566;
            job.Value_of_Current_Completed_Work__c = 435;
            job.Zip_Code__c = 'test';
            jobList.add(job);
        }
        insert jobList;
    }
    public static void contentData(Integer num) {
        documentList = new List<document>();
        for (Integer i = 0; i < num; i++) {
            document doc = new document();
            doc.Name = 'Test';
            doc.FolderId = UserInfo.getUserId();
            documentList.add(doc);
        }
        insert documentList;
    }

    public static void contactData(Integer num) {
        System.runAs(userList[0]) {
            conList = new List<Contact>();
            for (Integer i = 0; i < num; i++) {
                Contact con = new Contact();
                con.LastName = 'TEst';
                con.AccountId = accountList[i].Id;
                con.User__c = userList[0].Id;
                conList.add(con);
            }
            insert conList;
        }
    }
    public static void contactDataWithRecordtype(Integer num) {
        Id profileId = [SELECT Id FROM Profile WHERE Name = 'System Administrator'].Id;
        Integer randomNumber = Integer.valueof((Math.random() * 1000));
        String email = 'unit.test.user+' + randomNumber + '@test.com';
        User testUser = new User(
            FirstName = 'Test',
            LastName = 'User ',
            Email = email,
            Username = email,
            Alias = ('tuser' + randomNumber).right(8),
            Phone = '503-555-1212',
            ProfileId = profileId,
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'ISO-8859-1',
            LanguageLocaleKey = 'en_US'
        );
        insert testUser;
        conList = new List<Contact>();
        Id wfRecordTypeId = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName()
                      .get('Employee_WF_Recon').getRecordTypeId();
        for (Integer i = 0; i < num; i++) {
            Contact con = new Contact();
            con.LastName = 'TEst';
            con.Email = 'testemail@testing.com';
            con.User__c = testUser.Id;
            con.RecordTypeId = wfRecordTypeId;
            conList.add(con);
        }
        insert conList;
    }
    public static void mobdata(Integer num) {
        mobList = new List<Mobilization__c>();
        Mobilization_Group__c mGroup = new Mobilization_Group__c(Job__c=jobList[0].Id,Start_Date__c=System.now(),
                        End_Date__c = System.now(),Mobilization_Status__c = 'Confirmed');
        INSERT mGroup;
        for (Integer i = 0; i < num; i++) {
            Mobilization__c mob = new Mobilization__c();
            mob.Job__c = jobList[i].Id;
            mob.Start_Date__c = System.now();
            mob.End_Date__c = System.now();
            mob.Mobilization_Status__c = 'Confirmed';
            mob.MobiliZation_Group__c=mGroup.Id;
            mobList.add(mob);
        }
        for (Integer i = 0; i < num; i++) {
            Mobilization__c mob = new Mobilization__c();
            mob.Job__c = jobList[i].Id;
            mob.Start_Date__c = System.now() + 1;
            mob.End_Date__c = System.now() - 3;
            mob.Mobilization_Status__c = 'Confirmed';
            mob.MobiliZation_Group__c=mGroup.Id;
            mobList.add(mob);
        }
        insert mobList;
    }

    public static void AssetData(Integer num) {
        astList = new List<Equipment__c>();
        for (Integer i = 0; i < num; i++) {
            Equipment__c ast = new Equipment__c();
            ast.Name = 'Name';
            ast.AccountId__c = accountList[i].Id;
            ast.ContactId__c = conList[i].Id;
            ast.Asset_Type__c = 'Vehicle';
            astList.add(ast);
        }
        insert astList;
    }

    public static void MobAssetData(Integer num) {
        AssetList = new List<Mobilization_Asset__c>();
        for (Integer i = 0; i < num; i++) {
            Mobilization_Asset__c asset = new Mobilization_Asset__c();
            asset.Equipment__c = astList[i].Id;
            asset.Mobilization__c = mobList[i].Id;
            asset.Active__c = true;

            AssetList.add(asset);
        }
        insert AssetList;
    }

    public static void memberData(Integer num) {
        Contact contact = [SELECT Id FROM Contact WHERE User__c = :userList[0].Id][0];
        memberData(num, contact.Id);
    }

    public static void memberData(Integer num, String contactId) {
        memberList = new List<Mobilization_Member__c>();
        for (Integer i = 0; i < num; i++) {
            memberList.add(createMobMember(mobList[i].Id, contactId));
        }
        insert memberList;
    }

    public static Mobilization_Member__c createMobMember(String mobilizationId, String contactId) {
        return new Mobilization_Member__c(Mobilization__c = mobilizationId, Contact__c = contactId);
    }

    public static void TimesheetData(Integer num) {
        TimesheetList = new List<TimeSheet__c>();
        for (Integer i = 0; i < num; i++) {
            TimeSheet__c timesheet = new TimeSheet__c();
            timesheet.Job__c = jobList[0].id;
            timesheet.Contact__c = conList[0].Id;
            timesheet.Time_In__c = System.now();
            timesheet.Time_Out__c = null;
            timesheet.Timesheet_Start_Date__c = System.today();
            timesheet.Timesheet_End_Date__c = System.today().addDays(12);
            TimesheetList.add(timesheet);
        }
        insert TimesheetList;
    }

    public static void TimesheetEntryData(Integer num) {
        TimesheetEntryList = new List<Timesheet_Entry__c>();
        for (Integer i = 0; i < num; i++) {
            Timesheet_Entry__c timesheetentry = new Timesheet_Entry__c();

            timesheetentry.TimeSheet__c = TimesheetList[0].Id;
            timesheetentry.Entry_Date__c = System.today();
            TimesheetEntryList.add(timesheetentry);
        }
        insert TimesheetEntryList;
    }

    public static void TimesheetEntryItemData(Integer num) {
        timeEntryItem = new List<Timesheet_Entry_Item__c>();
        for (Integer i = 0; i < num; i++) {
            Timesheet_Entry_Item__c tEntry = new Timesheet_Entry_Item__c();
            tEntry.Timesheet_Entry__c = TimesheetEntryList[i].Id;
            tEntry.Clock_In_Time__c = System.today();
            tEntry.Clock_Out_Time__c = System.today() + 5;
            tEntry.Cost_Code__c = costCodeList[i].Id;
            tEntry.End_Time__c = Time.newInstance(18, 30, 2, 25);
            tEntry.Start_Time__c = Time.newInstance(18, 30, 2, 20);
            timeEntryItem.add(tEntry);
        }
        insert timeEntryItem;
    }

    public static void ExpenseData(Integer num) {
        ExpenseList = new List<Expense__c>();
        for (Integer i = 0; i < num; i++) {
            Expense__c expense = new Expense__c();
            expense.Job__c = jobList[i].Id;
            Expense.Transaction_Date__c = System.today();
            Expense.Amount__c = 100;
            ExpenseList.add(expense);
        }
        insert ExpenseList;
    }
}