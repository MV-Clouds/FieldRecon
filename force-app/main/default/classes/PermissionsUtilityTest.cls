@IsTest
private class PermissionsUtilityTest {

    @TestSetup
    static void setupData() {

        // Create a User for runAs()
        Profile p = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];

        User u = new User(
            FirstName = 'PS',
            LastName = 'TestUser',
            Email = 'pstest@test.com',
            Username = 'pstest' + DateTime.now().getTime() + '@test.com',
            Alias = 'pst',
            TimeZoneSidKey = 'GMT',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US',
            ProfileId = p.Id
        );
        insert u;

        // Assign a standard permission set to the user
        PermissionSet standardPs = [
            SELECT Id, Name
            FROM PermissionSet
            WHERE IsOwnedByProfile = false
            AND PermissionsViewAllData = false
            LIMIT 1
        ];

        insert new PermissionSetAssignment(
            AssigneeId = u.Id,
            PermissionSetId = standardPs.Id
        );
    }

    @IsTest
    static void test_CheckPermissionSetsAssigned_DirectAndGroup() {
        User u = [SELECT Id FROM User WHERE Alias = 'pst' LIMIT 1];

        // Fetch the same PS assigned in setup
        PermissionSet ps = [
            SELECT Name
            FROM PermissionSet
            WHERE Id IN (SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId = :u.Id)
            LIMIT 1
        ];

        for (PermissionSet psFlags : [SELECT Id FROM PermissionSet WHERE Name IN ('wfrecon__FR_Base','wfrecon__FR_Admin')]) {
            insert new PermissionSetAssignment(
                AssigneeId = u.Id,
                PermissionSetId = psFlags.Id
            );
        }

        // Prepare input list
        List<String> input = new List<String>{ ps.Name };

        Test.startTest();
        System.runAs(u) {
            Map<String, Object> result = PermissionsUtility.checkPermissionSetsAssigned(input);

            System.assertEquals(true, result.get('any'), 'ANY should be true for direct PS');
            System.assertEquals(true, result.get('all'), 'ALL should be true for direct PS');

            Map<String, Boolean> assignedMap = (Map<String, Boolean>) result.get('assignedMap');
            System.assertEquals(true, assignedMap.get(ps.Name), 'Direct permission must be assigned');


            result = PermissionsUtility.checkPermissionSetsAssigned(new List<String>{ 'InvalidPermissionXYZ' });

            System.assertEquals(false, result.get('any'));
            System.assertEquals(false, result.get('all'));

            assignedMap = (Map<String, Boolean>)result.get('assignedMap');
            System.assertEquals(false, assignedMap.get('InvalidPermissionXYZ'));


            result = PermissionsUtility.checkPermissionSetsAssigned(null);

            System.assertEquals(false, result.get('any'));
            System.assertEquals(false, result.get('all'));
        }
        Test.stopTest();
    }
}