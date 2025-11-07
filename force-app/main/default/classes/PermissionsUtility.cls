public with sharing class PermissionsUtility {
/**
 * Description: Utility Class for permission related methods
 * Test Class: PermissionsUtilityTest - 85% (2025-11-03)
 * Created By: Kevin Suvagiya
 * Created Date: 2025-11-03
 * Update: 2025-11-03 (Kevin)   - Added the method to check if the current user is assigned to specific permission sets or not
 */
    private static final String CLASSNAME = 'PermissionsUtility';

    /**
     * Description: Checks if the current user has ALL or ANY of the provided Permission Sets, including those granted via Permission Set Groups.
     * Parameters: psNames (List<String>) - API Names of the Permission Sets.
     * Return: Map<String, Object> - Response with All, Any or PermissionSet wise Booleans
     */
    @AuraEnabled
    public static Map<String, Object> checkPermissionSetsAssigned(List<String> psNames) {
        Map<String, Boolean> perSetAssignmentMap = new Map<String, Boolean>();
        Map<String, Object> result = new Map<String, Object>{'all' => false, 'any' => false, 'isAdmin' => false, 'isBase' => false, 'assignedMap' => perSetAssignmentMap};

        try {
            if (psNames == null || psNames.isEmpty()) {
                return result;
            }

            Set<String> assignedSet = new Set<String>();

            List<String> psNamesWithDefaultPs = new List<String>();
            psNamesWithDefaultPs.addAll(psNames);
            psNamesWithDefaultPs.add('FR_Base');
            psNamesWithDefaultPs.add('FR_Admin');

            // Direct assignments (Permission Set → User)
            // Permission Set that are assigned through the groups are also included in PermissionSetAssignment
            for (PermissionSetAssignment psa : [
                SELECT PermissionSet.Name
                FROM PermissionSetAssignment
                WHERE AssigneeId = :UserInfo.getUserId()
                      AND PermissionSet.Name IN :psNamesWithDefaultPs
                WITH USER_MODE
            ]) {
                if(psa.PermissionSet.Name == 'FR_Base'){
                    result.put('isBase', true);
                } else if(psa.PermissionSet.Name == 'FR_Admin'){
                    result.put('isAdmin', true);
                } else{
                    assignedSet.add(psa.PermissionSet.Name);
                }
            }

            // Populate per permission set result
            for (String permName : psNames) {
                perSetAssignmentMap.put(permName, assignedSet.contains(permName));
            }

            result.put('all', assignedSet.size() == psNames.size());
            result.put('any', !assignedSet.isEmpty());
            result.put('assignedMap', perSetAssignmentMap);

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className'   => CLASSNAME, 'methodName'  => 'checkPermissionSetsAssigned', 'isApiException' => false, 'statusCode'  => null, 'exceptionObj'=> e, 'moreDetails' => 'Error while checking permission set assignments (direct + via group).', 'apiResponse' => null });
            result.put('error', e.getMessage());
        }
        return result;
    }
}