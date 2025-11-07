global class BatchAssignPermissionSets implements Database.Batchable<PermissionSetAssignment>, Database.Stateful {

    private List<PermissionSetAssignment> assignments;
    private List<String> failedAssignments = new List<String>();

    global BatchAssignPermissionSets(List<PermissionSetAssignment> assignmentsToInsert) {
        this.assignments = assignmentsToInsert;
    }

    global Iterable<PermissionSetAssignment> start(Database.BatchableContext bc) {
        return assignments;
    }

    global void execute(Database.BatchableContext bc, List<PermissionSetAssignment> scope) {
        if (scope.isEmpty()) return;

        try {
            insert scope; // single DML operation — all or none
        } catch (DmlException e) {
            // capture all failed records and their cause
            for (PermissionSetAssignment psa : scope) {
                failedAssignments.add(
                    'UserId: ' + psa.AssigneeId +
                    ' | PermissionSetId: ' + psa.PermissionSetId +
                    ' | Error: ' + e.getMessage()
                );
            }
        } catch (Exception e) {
            failedAssignments.add('Unexpected error in batch: ' + e.getMessage());
        }
    }

    global void finish(Database.BatchableContext bc) {
        String emailBody;
        if (failedAssignments.isEmpty()) {
            emailBody = '✅ All Permission Set assignments were processed successfully.';
        } else {
            emailBody = '⚠️ Some Permission Set assignments failed.\n\nDetails:\n';
            emailBody += String.join(failedAssignments, '\n');
        }

        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(new String[] { 'fieldrecon@mvclouds.com' });
        email.setSubject('BatchAssignPermissionSets Completed - ' + Datetime.now());
        email.setPlainTextBody(emailBody);
        email.setSaveAsActivity(false);
        Messaging.sendEmail(new Messaging.SingleEmailMessage[] { email });
    }
}