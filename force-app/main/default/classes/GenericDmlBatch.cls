/**
 * Description: Generic batch class to perform DML (INSERT/UPDATE/DELETE) on large record sets safely. Accepts a list of SObjects and an operation type, executes DML in batches, and logs failures via ExceptionHandler for observability.
 * Test Class: Will be covered by other classes using it
 * Created By: Kevin Suvagiya
 * Created Date: 2025-10-06
 * Update: 2025-11-07 (Kevin) - Updated the code to handle only the Insert, Update and Delete operations
 */
public class GenericDmlBatch implements Database.Batchable<SObject>, Database.Stateful {

    private static final String CLASSNAME = 'GenericDmlBatch';

    private List<SObject> inputList;
    private String operationType;

    public GenericDmlBatch(List<SObject> records, String operationType) {
        this.inputList = records;
        this.operationType = (operationType != null ? operationType.trim().toUpperCase() : 'INSERT');
    }

    public Iterable<SObject> start(Database.BatchableContext bc) {
        return inputList;
    }

    public void execute(Database.BatchableContext bc, List<SObject> scope) {
        try {
            switch on operationType {

                when 'INSERT' {
                    Database.SaveResult[] results = Database.insert(scope, false);
                    logFailures(results, 'INSERT');
                }

                when 'UPDATE' {
                    Database.SaveResult[] results = Database.update(scope, false);
                    logFailures(results, 'UPDATE');
                }

                when 'DELETE' {
                    Database.DeleteResult[] results = Database.delete(scope, false);
                    logFailures(results, 'DELETE');
                }

                when else {
                    throw new AuraHandledException('Invalid operation passed to GenericDmlBatch: ' + operationType);
                }
            }
        }
        catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className'   => CLASSNAME, 'methodName'  => 'execute', 'isApiException' => false, 'statusCode'  => null, 'exceptionObj'=> e, 'moreDetails' => 'Error occurred while executing batch DML: ' + operationType, 'apiResponse' => null });
        }
    }

    public void finish(Database.BatchableContext bc) {
        // Nothing required to do here.
    }


    /**
     * Logs failed records using ExceptionHandler
     */
    private void logFailures(List<Database.SaveResult> results, String dmlType) {
        for (Integer i = 0; i < results.size(); i++) {
            if (!results[i].isSuccess()) {
                ExceptionHandler.logException(new Map<String, Object>{ 'className'   => CLASSNAME, 'methodName'  => 'execute - ' + dmlType, 'isApiException' => false, 'statusCode'  => results[i].getErrors()[0].getStatusCode(), 'exceptionObj'=> results[i].getErrors()[0], 'moreDetails' => 'Failed record Id: ' + results[i].getId(), 'apiResponse' => null });
            }
        }
    }

    private void logFailures(List<Database.DeleteResult> results, String dmlType) {
        for (Integer i = 0; i < results.size(); i++) {
            if (!results[i].isSuccess()) {
                ExceptionHandler.logException(new Map<String, Object>{ 'className'   => CLASSNAME, 'methodName'  => 'execute - ' + dmlType, 'isApiException' => false, 'statusCode'  => results[i].getErrors()[0].getStatusCode(), 'exceptionObj'=> results[i].getErrors()[0], 'moreDetails' => 'Failed delete Id: ' + results[i].getId(), 'apiResponse' => null });
            }
        }
    }
}