public with sharing class ManagementTabController {

    public static final String CLASSNAME = 'ManagementTabController';

    @AuraEnabled
    public static List<Process__c> getProcessLibraries() {
        List<Process__c> processLibraries = new List<Process__c>();
        
        try {
            processLibraries = [
                SELECT Id, Name, Process_Name__c, Weight__c, Unit_of_Measure__c, Process_Type__c
                FROM Process__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getProcessLibraries', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Process Libraries : ' + e.getMessage(), 'apiResponse' => null});
        }

        return processLibraries;
    }

    @AuraEnabled
    public static List<Crew__c> getCrewMembers() {
        List<Crew__c> crewMembers = new List<Crew__c>();
        
        try {
            crewMembers = [
                SELECT Id, Name, Description__c, Color_Code__c, Crew_Member_Count__c
                FROM Crew__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewMembers', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Crew Members : ' + e.getMessage(), 'apiResponse' => null});
        }

        return crewMembers;
    }

    @AuraEnabled
    public static Map<String, Object> getCrewMobilizationSummary(Id crewId) {
        Map<String, Object> response = new Map<String, Object>{
            'upcomingMobilizations' => 0
        };

        if (crewId == null) {
            return response;
        }

        try {
            Date today = Date.today();
            Set<Id> mobilizationIds = new Set<Id>();

            for (Mobilization_Member__c crewMobilization : [
                SELECT Mobilization__c
                FROM Mobilization_Member__c
                WHERE Crew__c = :crewId
                AND Mobilization__r.Start_Date__c >= :today
                AND Mobilization__c != null
                WITH USER_MODE
            ]) {
                if (crewMobilization.Mobilization__c != null) {
                    mobilizationIds.add(crewMobilization.Mobilization__c);
                }
            }

            response.put('upcomingMobilizations', mobilizationIds.size());
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME,
                'methodName' => 'getCrewMobilizationSummary',
                'isApiException' => false,
                'statusCode' => null,
                'exceptionObj' => e,
                'moreDetails' => 'Error fetching crew mobilization summary : ' + e.getMessage(),
                'apiResponse' => null
            });
        }

        return response;
    }

    @AuraEnabled
    public static Map<String, Object> saveCrew(Map<String, Object> crewData) {
        Map<String, Object> response = new Map<String, Object>{
            'status' => 'ERROR',
            'message' => 'Unable to save crew.'
        };
        Integer mobilizationsEvaluated = 0;
        Integer mobilizationAssignmentsCreated = 0;
        Integer mobilizationsWithOverlap = 0;
        Set<Id> overlappingContacts = new Set<Id>();
        Map<Id, Set<Id>> overlappingContactsByMobilization = new Map<Id, Set<Id>>();
        Integer mobilizationAssignmentsSkippedDueToOverlap = 0;
        List<MobilizationOverlapDetailDTO> overlapDetails = new List<MobilizationOverlapDetailDTO>();

        try {
            if (crewData == null || crewData.isEmpty()) {
                response.put('message', 'Crew details are required.');
                return response;
            }

            Object idValue = crewData.get('Id');
            Id crewId;
            if (idValue != null) {
                crewId = idValue instanceof Id ? (Id)idValue : Id.valueOf(String.valueOf(idValue));
            }

            String crewName = (String)crewData.get('Name');
            if (String.isBlank(crewName)) {
                response.put('message', 'Crew name is required.');
                return response;
            }

            Crew__c crewRecord = new Crew__c();
            crewRecord.Name = crewName;
            if (crewId != null) {
                crewRecord.Id = crewId;
            }

            if (crewData.containsKey('Description__c')) {
                crewRecord.Description__c = (String)crewData.get('Description__c');
            }

            if (crewData.containsKey('Color_Code__c')) {
                String colorCode = (String)crewData.get('Color_Code__c');
                if (!String.isBlank(colorCode) && !colorCode.startsWith('#')) {
                    colorCode = '#' + colorCode;
                }
                crewRecord.Color_Code__c = colorCode;
            }

            List<Id> membersToAdd = new List<Id>();
            if (crewData.containsKey('membersToAdd') && crewData.get('membersToAdd') != null) {
                for (Object memberVal : (List<Object>)crewData.get('membersToAdd')) {
                    if (memberVal == null) {
                        continue;
                    }
                    membersToAdd.add(memberVal instanceof Id ? (Id)memberVal : Id.valueOf(String.valueOf(memberVal)));
                }
            }

            List<Id> memberRecordIdsToRemove = new List<Id>();
            if (crewData.containsKey('membersToRemove') && crewData.get('membersToRemove') != null) {
                for (Object memberVal : (List<Object>)crewData.get('membersToRemove')) {
                    if (memberVal == null) {
                        continue;
                    }
                    memberRecordIdsToRemove.add(memberVal instanceof Id ? (Id)memberVal : Id.valueOf(String.valueOf(memberVal)));
                }
            }

            Boolean assignToFutureMobilizations = false;
            if (crewData.containsKey('assignToFutureMobilizations') && crewData.get('assignToFutureMobilizations') != null) {
                Object assignValue = crewData.get('assignToFutureMobilizations');
                if (assignValue instanceof Boolean) {
                    assignToFutureMobilizations = (Boolean)assignValue;
                } else {
                    assignToFutureMobilizations = 'true'.equalsIgnoreCase(String.valueOf(assignValue));
                }
            }

            String overlapResolution;
            if (crewData.containsKey('overlapResolution') && crewData.get('overlapResolution') != null) {
                overlapResolution = String.valueOf(crewData.get('overlapResolution'));
                if (!String.isBlank(overlapResolution)) {
                    overlapResolution = overlapResolution.trim().toUpperCase();
                } else {
                    overlapResolution = null;
                }
            }

            if (crewRecord.Id == null) {
                insert crewRecord;
            } else {
                update crewRecord;
            }

            crewId = crewRecord.Id;

            if (!memberRecordIdsToRemove.isEmpty()) {
                List<Crew_Member__c> membersToDelete = [
                    SELECT Id
                    FROM Crew_Member__c
                    WHERE Id IN :memberRecordIdsToRemove
                    WITH USER_MODE
                ];

                if (!membersToDelete.isEmpty()) {
                    delete membersToDelete;
                }
            }

            if (!membersToAdd.isEmpty()) {
                Set<Id> contactIdsToInsert = new Set<Id>(membersToAdd);

                List<Crew_Member__c> existingMembers = [
                    SELECT Id, Contact__c
                    FROM Crew_Member__c
                    WHERE Crew__c = :crewId AND Contact__c IN :contactIdsToInsert
                    WITH USER_MODE
                ];

                for (Crew_Member__c existingMember : existingMembers) {
                    contactIdsToInsert.remove(existingMember.Contact__c);
                }

                if (!contactIdsToInsert.isEmpty()) {
                    List<Crew_Member__c> membersToInsert = new List<Crew_Member__c>();
                    for (Id contactId : contactIdsToInsert) {
                        membersToInsert.add(new Crew_Member__c(Crew__c = crewId, Contact__c = contactId));
                    }
                    insert membersToInsert;

                    if (assignToFutureMobilizations) {
                        MobilizationPropagationResult propagationResult = handleMobilizationPropagation(crewId, contactIdsToInsert, overlapResolution);
                        mobilizationsEvaluated = propagationResult.mobilizationsEvaluated;

                        if ('OVERLAP'.equalsIgnoreCase(propagationResult.status)) {
                            response.put('status', 'OVERLAP');
                            response.put('message', String.isBlank(propagationResult.message)
                                ? 'Resource allocation is overlapping. How would you like to proceed?'
                                : propagationResult.message);
                            response.put('crewId', crewId);
                            response.put('membersAdded', membersToAdd.size());
                            response.put('membersRemoved', memberRecordIdsToRemove.size());
                            response.put('mobilizationsEvaluated', mobilizationsEvaluated);
                            response.put('mobilizationsWithOverlap', propagationResult.mobilizationsWithOverlap);
                            response.put('mobilizationAssignmentsCreated', propagationResult.assignmentsCreated);
                            response.put('mobilizationAssignmentsSkipped', propagationResult.assignmentsSkipped);

                            if (!propagationResult.overlapDetails.isEmpty()) {
                                response.put('overlapDetails', propagationResult.overlapDetails);
                            }

                            if (!propagationResult.overlappingContacts.isEmpty()) {
                                response.put('overlappingContacts', new List<Id>(propagationResult.overlappingContacts));
                            }

                            if (!propagationResult.overlappingContactsByMobilization.isEmpty()) {
                                Map<Id, List<Id>> overlapContactMap = new Map<Id, List<Id>>();
                                for (Id mobilizationId : propagationResult.overlappingContactsByMobilization.keySet()) {
                                    overlapContactMap.put(mobilizationId, new List<Id>(propagationResult.overlappingContactsByMobilization.get(mobilizationId)));
                                }
                                response.put('overlappingContactsByMobilization', overlapContactMap);
                            }

                            return response;
                        }

                        mobilizationAssignmentsCreated = propagationResult.assignmentsCreated;
                        mobilizationsWithOverlap = propagationResult.mobilizationsWithOverlap;
                        overlapDetails = propagationResult.overlapDetails;
                        overlappingContacts = propagationResult.overlappingContacts;
                        overlappingContactsByMobilization = propagationResult.overlappingContactsByMobilization;
                        mobilizationAssignmentsSkippedDueToOverlap = propagationResult.assignmentsSkipped;
                    }
                }
            }

            Integer memberCount;
            if (crewData.containsKey('selectedMemberIds') && crewData.get('selectedMemberIds') != null) {
                memberCount = ((List<Object>)crewData.get('selectedMemberIds')).size();
            } else {
                memberCount = [
                    SELECT COUNT()
                    FROM Crew_Member__c
                    WHERE Crew__c = :crewId
                ];
            }

            response.put('status', 'SUCCESS');
            response.put('message', 'Crew saved successfully.');
            response.put('crewId', crewId);
            response.put('memberCount', memberCount);
            response.put('membersAdded', membersToAdd.size());
            response.put('membersRemoved', memberRecordIdsToRemove.size());
            response.put('mobilizationsEvaluated', mobilizationsEvaluated);
            response.put('mobilizationAssignmentsCreated', mobilizationAssignmentsCreated);
            response.put('mobilizationsWithOverlap', mobilizationsWithOverlap);
            response.put('mobilizationAssignmentsSkipped', mobilizationAssignmentsSkippedDueToOverlap);

            if (!overlapDetails.isEmpty()) {
                response.put('overlapDetails', overlapDetails);
            }

            if (!overlappingContacts.isEmpty()) {
                response.put('overlappingContacts', new List<Id>(overlappingContacts));
            }

            if (!overlappingContactsByMobilization.isEmpty()) {
                Map<Id, List<Id>> overlapContactMap = new Map<Id, List<Id>>();
                for (Id mobilizationId : overlappingContactsByMobilization.keySet()) {
                    overlapContactMap.put(mobilizationId, new List<Id>(overlappingContactsByMobilization.get(mobilizationId)));
                }
                response.put('overlappingContactsByMobilization', overlapContactMap);
            }
            return response;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'saveCrew', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error saving Crew : ' + e.getMessage(), 'apiResponse' => null});
            response.put('message', 'Error: ' + e.getMessage());
            return response;
        }
    }

    @AuraEnabled
    public static String deleteProcess(String processId) {
        try {
            
            if (processId != null) {
                delete as user (new Process__c(Id = processId));
                return 'Success';
            } else {
                return 'Process not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteProcess', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Process : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static Process__c upsertProcess(Process__c processRecord) {
        try {
            if (processRecord != null) {
                upsert as user processRecord;
                return processRecord;
            } else {
                throw new AuraHandledException('Process record is null');
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'upsertProcess', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error upserting Process : ' + e.getMessage(), 'apiResponse' => null});
            throw new AuraHandledException('Error saving process: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Map<String, Object> getCrewContacts(Id crewId) {
        List<CrewContactDTO> assignedContacts = new List<CrewContactDTO>();
        List<CrewContactDTO> availableContacts = new List<CrewContactDTO>();

        Map<String, Object> response = new Map<String, Object>{
            'assignedContacts' => assignedContacts,
            'availableContacts' => availableContacts
        };

        try {
            List<Contact> crewCandidates = [
                SELECT Id, Name,
                    (SELECT Id, Crew__c, Crew__r.Name, Crew__r.Color_Code__c
                     FROM Crew_Members__r)
                FROM Contact
                WHERE RecordType.DeveloperName = 'Employee_WF_Recon'
                AND User__r.IsActive = true
                WITH USER_MODE
                ORDER BY Name
            ];

            for (Contact contactRecord : crewCandidates) {
                CrewContactDTO contactDto = new CrewContactDTO();
                contactDto.id = contactRecord.Id;
                contactDto.name = contactRecord.Name;
                contactDto.isAssignedElsewhere = false;
                contactDto.isAssignedToCurrentCrew = false;

                if (contactRecord.Crew_Members__r != null && !contactRecord.Crew_Members__r.isEmpty()) {
                    List<String> crewNames = new List<String>();

                    for (Crew_Member__c member : contactRecord.Crew_Members__r) {
                        CrewMemberDTO memberDto = new CrewMemberDTO();
                        memberDto.memberId = member.Id;
                        memberDto.crewId = member.Crew__c;
                        memberDto.crewName = member.Crew__r != null ? member.Crew__r.Name : null;
                        memberDto.colorCode = member.Crew__r != null ? member.Crew__r.Color_Code__c : null;
                        contactDto.members.add(memberDto);

                        if (!String.isBlank(memberDto.crewName)) {
                            crewNames.add(memberDto.crewName);
                        }

                        if (crewId != null && member.Crew__c == crewId) {
                            contactDto.isAssignedToCurrentCrew = true;
                            contactDto.currentCrewMemberId = member.Id;
                        } else if (member.Crew__c != null) {
                            contactDto.isAssignedElsewhere = true;
                        }

                        if (String.isBlank(contactDto.primaryCrewColor) && !String.isBlank(memberDto.colorCode)) {
                            contactDto.primaryCrewColor = memberDto.colorCode;
                        }
                    }

                    contactDto.assignedCrewNames = crewNames.isEmpty() ? null : String.join(crewNames, ', ');
                }

                if (contactDto.isAssignedToCurrentCrew) {
                    assignedContacts.add(contactDto);
                } else {
                    availableContacts.add(contactDto);
                }
            }

            availableContacts.sort();
            assignedContacts.sort();
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCrewContacts', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching crew contacts : ' + e.getMessage(), 'apiResponse' => null});
        }

        return response;
    }

    @AuraEnabled
    public static String deleteCrew(String crewId) {
        try {
            if (crewId != null) {
                delete as user (new Crew__c(Id = crewId));  
                return 'Success';
            } else {
                return 'Crew not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCrew', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Crew : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static List<Cost_Code__c> getCostCodes() {
        List<Cost_Code__c> costCodes = new List<Cost_Code__c>();
        
        try {
            costCodes = [
                SELECT Id, Name, Classification_Type__c, Code__c, Level_Code__c
                FROM Cost_Code__c
                WITH USER_MODE
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'getCostCodes', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error fetching Cost Codes : ' + e.getMessage(), 'apiResponse' => null});
        }

        return costCodes;
    }

    @AuraEnabled
    public static String deleteCostCode(String costCodeId) {
        try {
            if (costCodeId != null) {
                delete as user (new Cost_Code__c(Id = costCodeId));
                return 'Success';
            } else {
                return 'Cost Code not found';
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'deleteCostCode', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error deleting Cost Code : ' + e.getMessage(), 'apiResponse' => null});
            return 'Error: ' + e.getMessage();
        }
    }

    @AuraEnabled
    public static Cost_Code__c upsertCostCode(Cost_Code__c costCodeRecord) {
        try {
            if (costCodeRecord != null) {
                upsert as user costCodeRecord;
                return costCodeRecord;
            } else {
                throw new AuraHandledException('Cost Code record is null');
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => CLASSNAME, 'methodName' => 'upsertCostCode', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e,'moreDetails' => 'Error upserting Cost Code : ' + e.getMessage(), 'apiResponse' => null});
            throw new AuraHandledException('Error saving cost code: ' + e.getMessage());
        }
    }

    private class MobilizationPropagationResult {
        public String status = 'SUCCESS';
        public Integer mobilizationsEvaluated = 0;
        public Integer assignmentsCreated = 0;
        public Integer assignmentsSkipped = 0;
        public Integer mobilizationsWithOverlap = 0;
        public Set<Id> overlappingContacts = new Set<Id>();
        public Map<Id, Set<Id>> overlappingContactsByMobilization = new Map<Id, Set<Id>>();
        public List<MobilizationOverlapDetailDTO> overlapDetails = new List<MobilizationOverlapDetailDTO>();
        public String message;
    }

    public class MobilizationOverlapTargetDTO {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Id crewId;
        @AuraEnabled public String crewName;
    }

    public class MobilizationOverlapDateDTO {
        @AuraEnabled public String dateValue;
        @AuraEnabled public String dateLabel;
        @AuraEnabled public List<MobilizationOverlapTargetDTO> targetMobilizations = new List<MobilizationOverlapTargetDTO>();
        @AuraEnabled public List<MobilizationOverlapTargetDTO> conflictingMobilizations = new List<MobilizationOverlapTargetDTO>();
    }

    public class MobilizationOverlapDetailDTO {
        @AuraEnabled public Id contactId;
        @AuraEnabled public String contactName;
        @AuraEnabled public List<MobilizationOverlapDateDTO> dates = new List<MobilizationOverlapDateDTO>();
    }

    private static MobilizationPropagationResult handleMobilizationPropagation(Id crewId, Set<Id> contactIdsToInsert, String overlapResolution) {
        MobilizationPropagationResult result = new MobilizationPropagationResult();

        if (crewId == null || contactIdsToInsert == null || contactIdsToInsert.isEmpty()) {
            return result;
        }

        Date today = Date.today();
        List<Mobilization_Member__c> crewMobilizations = [
            SELECT Mobilization__c
            FROM Mobilization_Member__c
            WHERE Crew__c = :crewId
            AND Mobilization__r.Start_Date__c >= :today
            AND Mobilization__c != null
            WITH USER_MODE
        ];

        Set<Id> mobilizationIds = new Set<Id>();
        for (Mobilization_Member__c crewMob : crewMobilizations) {
            if (crewMob.Mobilization__c != null) {
                mobilizationIds.add(crewMob.Mobilization__c);
            }
        }

        result.mobilizationsEvaluated = mobilizationIds.size();

        if (mobilizationIds.isEmpty()) {
            return result;
        }

        Map<Id, Set<Id>> existingAssignments = new Map<Id, Set<Id>>();
        for (Mobilization_Member__c existingAssignment : [
            SELECT Mobilization__c, Contact__c
            FROM Mobilization_Member__c
            WHERE Mobilization__c IN :mobilizationIds
            AND Contact__c IN :contactIdsToInsert
            WITH USER_MODE
        ]) {
            if (existingAssignment.Mobilization__c == null || existingAssignment.Contact__c == null) {
                continue;
            }

            if (!existingAssignments.containsKey(existingAssignment.Mobilization__c)) {
                existingAssignments.put(existingAssignment.Mobilization__c, new Set<Id>());
            }
            existingAssignments.get(existingAssignment.Mobilization__c).add(existingAssignment.Contact__c);
        }

        List<Mobilization_Member__c> mobilizationInserts = new List<Mobilization_Member__c>();
        for (Id mobilizationId : mobilizationIds) {
            Set<Id> alreadyAssigned = existingAssignments.containsKey(mobilizationId)
                ? existingAssignments.get(mobilizationId)
                : new Set<Id>();

            for (Id contactId : contactIdsToInsert) {
                if (contactId == null || alreadyAssigned.contains(contactId)) {
                    continue;
                }

                mobilizationInserts.add(new Mobilization_Member__c(
                    Mobilization__c = mobilizationId,
                    Contact__c = contactId,
                    Crew__c = crewId
                ));
            }
        }

        if (mobilizationInserts.isEmpty()) {
            return result;
        }

        Map<Id, Mobilization__c> mobilizationMap = new Map<Id, Mobilization__c>([
            SELECT Id, Name, Start_Date__c
            FROM Mobilization__c
            WHERE Id IN :mobilizationIds
            WITH USER_MODE
        ]);

        Map<Id, Map<DateTime, List<Id>>> plannedAssignments = new Map<Id, Map<DateTime, List<Id>>>();
        for (Mobilization_Member__c pendingInsert : mobilizationInserts) {
            if (pendingInsert.Contact__c == null) {
                continue;
            }

            Mobilization__c mobilizationRecord = mobilizationMap.get(pendingInsert.Mobilization__c);
            if (mobilizationRecord == null || mobilizationRecord.Start_Date__c == null) {
                continue;
            }

            DateTime mobilizationStart = mobilizationRecord.Start_Date__c;

            if (!plannedAssignments.containsKey(pendingInsert.Contact__c)) {
                plannedAssignments.put(pendingInsert.Contact__c, new Map<DateTime, List<Id>>());
            }

            Map<DateTime, List<Id>> datePlan = plannedAssignments.get(pendingInsert.Contact__c);
            if (!datePlan.containsKey(mobilizationStart)) {
                datePlan.put(mobilizationStart, new List<Id>());
            }
            datePlan.get(mobilizationStart).add(pendingInsert.Mobilization__c);
        }

        Set<DateTime> mobilizationDates = new Set<DateTime>();
        for (Mobilization__c mobilizationRecord : mobilizationMap.values()) {
            if (mobilizationRecord.Start_Date__c != null) {
                mobilizationDates.add(mobilizationRecord.Start_Date__c);
            }
        }

        Map<Id, Map<DateTime, List<Mobilization_Member__c>>> overlapsByContactDate = new Map<Id, Map<DateTime, List<Mobilization_Member__c>>>();
        if (!mobilizationDates.isEmpty()) {
            for (Mobilization_Member__c overlapCandidate : [
                SELECT Mobilization__c, Mobilization__r.Name, Mobilization__r.Start_Date__c,
                       Contact__c, Contact__r.Name, Crew__c, Crew__r.Name
                FROM Mobilization_Member__c
                WHERE Contact__c IN :contactIdsToInsert
                AND Mobilization__r.Start_Date__c IN :mobilizationDates
                AND Mobilization__c NOT IN :mobilizationIds
                WITH USER_MODE
            ]) {
                if (overlapCandidate.Contact__c == null || overlapCandidate.Mobilization__r == null || overlapCandidate.Mobilization__r.Start_Date__c == null) {
                    continue;
                }

                if (!overlapsByContactDate.containsKey(overlapCandidate.Contact__c)) {
                    overlapsByContactDate.put(overlapCandidate.Contact__c, new Map<DateTime, List<Mobilization_Member__c>>());
                }

                Map<DateTime, List<Mobilization_Member__c>> dateOverlapMap = overlapsByContactDate.get(overlapCandidate.Contact__c);
                DateTime overlapDate = overlapCandidate.Mobilization__r.Start_Date__c;
                if (!dateOverlapMap.containsKey(overlapDate)) {
                    dateOverlapMap.put(overlapDate, new List<Mobilization_Member__c>());
                }
                dateOverlapMap.get(overlapDate).add(overlapCandidate);
            }
        }

        Map<Id, String> contactNames = new Map<Id, String>();
        if (!overlapsByContactDate.isEmpty()) {
            for (Contact contactRecord : [
                SELECT Id, Name
                FROM Contact
                WHERE Id IN :contactIdsToInsert
                WITH USER_MODE
            ]) {
                contactNames.put(contactRecord.Id, contactRecord.Name);
            }
        }

        Set<String> overlappingAssignmentKeys = new Set<String>();
        Map<Id, MobilizationOverlapDetailDTO> overlapDetailByContact = new Map<Id, MobilizationOverlapDetailDTO>();
        Set<Id> mobilizationsWithOverlapIds = new Set<Id>();

        for (Id contactId : plannedAssignments.keySet()) {
            Map<DateTime, List<Id>> datePlan = plannedAssignments.get(contactId);
            for (DateTime mobilizationDate : datePlan.keySet()) {
                List<Id> plannedMobilizationIds = datePlan.get(mobilizationDate);
                Map<DateTime, List<Mobilization_Member__c>> overlapDateMap = overlapsByContactDate.get(contactId);
                if (overlapDateMap == null || !overlapDateMap.containsKey(mobilizationDate)) {
                    continue;
                }

                List<Mobilization_Member__c> conflictingAssignments = overlapDateMap.get(mobilizationDate);
                if (conflictingAssignments == null || conflictingAssignments.isEmpty()) {
                    continue;
                }

                for (Id plannedMobId : plannedMobilizationIds) {
                    overlappingAssignmentKeys.add(contactId + ':' + plannedMobId);
                    mobilizationsWithOverlapIds.add(plannedMobId);

                    if (!result.overlappingContactsByMobilization.containsKey(plannedMobId)) {
                        result.overlappingContactsByMobilization.put(plannedMobId, new Set<Id>());
                    }
                    result.overlappingContactsByMobilization.get(plannedMobId).add(contactId);
                }

                result.overlappingContacts.add(contactId);

                MobilizationOverlapDetailDTO contactDetail = overlapDetailByContact.get(contactId);
                if (contactDetail == null) {
                    contactDetail = new MobilizationOverlapDetailDTO();
                    contactDetail.contactId = contactId;
                    contactDetail.contactName = contactNames.containsKey(contactId) ? contactNames.get(contactId) : null;
                    if (contactDetail.contactName == null && !conflictingAssignments.isEmpty() && conflictingAssignments[0].Contact__r != null) {
                        contactDetail.contactName = conflictingAssignments[0].Contact__r.Name;
                    }
                    overlapDetailByContact.put(contactId, contactDetail);
                }

                MobilizationOverlapDateDTO dateDetail = new MobilizationOverlapDateDTO();
                Long mobilizationEpoch = mobilizationDate != null ? mobilizationDate.getTime() : null;
                dateDetail.dateValue = mobilizationEpoch != null ? String.valueOf(mobilizationEpoch) : null;
                dateDetail.dateLabel = mobilizationDate.format('MMM d, yyyy');

                for (Id plannedMobId : plannedMobilizationIds) {
                    MobilizationOverlapTargetDTO targetInfo = new MobilizationOverlapTargetDTO();
                    targetInfo.id = plannedMobId;
                    Mobilization__c mobilizationRecord = mobilizationMap.get(plannedMobId);
                    if (mobilizationRecord != null) {
                        targetInfo.name = mobilizationRecord.Name;
                    }
                    dateDetail.targetMobilizations.add(targetInfo);
                }

                for (Mobilization_Member__c conflicting : conflictingAssignments) {
                    MobilizationOverlapTargetDTO conflictingInfo = new MobilizationOverlapTargetDTO();
                    conflictingInfo.id = conflicting.Mobilization__c;
                    if (conflicting.Mobilization__r != null) {
                        conflictingInfo.name = conflicting.Mobilization__r.Name;
                    }
                    conflictingInfo.crewId = conflicting.Crew__c;
                    if (conflicting.Crew__r != null) {
                        conflictingInfo.crewName = conflicting.Crew__r.Name;
                    }
                    dateDetail.conflictingMobilizations.add(conflictingInfo);
                }

                contactDetail.dates.add(dateDetail);
            }
        }

        result.mobilizationsWithOverlap = mobilizationsWithOverlapIds.size();

        if (!overlapDetailByContact.isEmpty()) {
            result.overlapDetails = new List<MobilizationOverlapDetailDTO>(overlapDetailByContact.values());
        }

        if (!overlappingAssignmentKeys.isEmpty()) {
            if (String.isBlank(overlapResolution) || (!'SKIP'.equalsIgnoreCase(overlapResolution) && !'ALLOW'.equalsIgnoreCase(overlapResolution))) {
                result.status = 'OVERLAP';
                result.message = 'Resource allocation is overlapping. How would you like to proceed?';
                return result;
            }

            if ('SKIP'.equalsIgnoreCase(overlapResolution)) {
                List<Mobilization_Member__c> filteredInserts = new List<Mobilization_Member__c>();
                for (Mobilization_Member__c pendingInsert : mobilizationInserts) {
                    String key = pendingInsert.Contact__c + ':' + pendingInsert.Mobilization__c;
                    if (overlappingAssignmentKeys.contains(key)) {
                        result.assignmentsSkipped++;
                        continue;
                    }
                    filteredInserts.add(pendingInsert);
                }
                mobilizationInserts = filteredInserts;
            }
        }

        if (mobilizationInserts.isEmpty()) {
            return result;
        }

        insert as user mobilizationInserts;
        result.assignmentsCreated = mobilizationInserts.size();

        return result;
    }

    @AuraEnabled
    public static List<StatusColorWrapper> getMobilizationStatusColors() {
        List<StatusColorWrapper> statusColorList = new List<StatusColorWrapper>();
        
        try {
            // Get all custom setting records
            Map<String, Mobilization_Status_Color__c> customSettingsMap = Mobilization_Status_Color__c.getAll();
            
            // Get picklist values from Mobilization__c.Mobilization_Status__c field
            Schema.DescribeFieldResult fieldResult = Mobilization__c.Mobilization_Status__c.getDescribe();
            List<Schema.PicklistEntry> picklistValues = fieldResult.getPicklistValues();
            
            for (Schema.PicklistEntry entry : picklistValues) {
                if (entry.isActive()) {
                    StatusColorWrapper wrapper = createStatusColorWrapper(entry, customSettingsMap);
                    statusColorList.add(wrapper);
                }
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME, 
                'methodName' => 'getMobilizationStatusColors', 
                'isApiException' => false, 
                'statusCode' => null, 
                'exceptionObj' => e,
                'moreDetails' => 'Error fetching mobilization status colors: ' + e.getMessage(), 
                'apiResponse' => null
            });
            throw new AuraHandledException('Error fetching mobilization status colors: ' + e.getMessage());
        }
        
        return statusColorList;
    }
    
    private static StatusColorWrapper createStatusColorWrapper(Schema.PicklistEntry entry, Map<String, Mobilization_Status_Color__c> customSettingsMap) {
        StatusColorWrapper wrapper = new StatusColorWrapper();
        wrapper.picklistValue = entry.getLabel();
        wrapper.apiValue = entry.getValue();
        
        // Check if custom setting exists for this picklist value
        // Try both the label and API value as keys
        Mobilization_Status_Color__c customSetting = null;
        if (customSettingsMap.containsKey(entry.getLabel())) {
            customSetting = customSettingsMap.get(entry.getLabel());
        } else if (customSettingsMap.containsKey(entry.getValue())) {
            customSetting = customSettingsMap.get(entry.getValue());
        }
        
        if (customSetting != null) {
            wrapper.id = customSetting.Id;
            wrapper.textColor = customSetting.wfrecon__Color__c != null ? customSetting.wfrecon__Color__c : '#000000';
            wrapper.backgroundColor = customSetting.wfrecon__Background_Color__c != null ? customSetting.wfrecon__Background_Color__c : '#c4c4c4';
            wrapper.hasCustomSetting = true;
        } else {
            // Default colors if no custom setting exists
            wrapper.id = null;
            wrapper.textColor = '#000000';
            wrapper.backgroundColor = '#c4c4c4';
            wrapper.hasCustomSetting = false;
        }
        
        return wrapper;
    }
    
    @AuraEnabled
    public static Map<String, Object> saveStatusColors(List<StatusColorWrapper> statusColors) {
        Map<String, Object> response = new Map<String, Object>{
            'status' => 'ERROR',
            'message' => 'Unable to save status colors.'
        };

        try {
            // Fetch all existing custom settings first
            Map<String, Mobilization_Status_Color__c> existingSettings = Mobilization_Status_Color__c.getAll();
            List<Mobilization_Status_Color__c> recordsToUpsert = new List<Mobilization_Status_Color__c>();

            for (StatusColorWrapper wrapper : statusColors) {
                Mobilization_Status_Color__c record;

                // If wrapper has an ID, it's an existing Custom Setting record
                if (String.isNotBlank(wrapper.id)) {
                    record = new Mobilization_Status_Color__c();
                    record.Id = wrapper.id;
                } else {
                    // Try to find existing record by Name (picklistValue or apiValue)
                    Mobilization_Status_Color__c existingRecord;
                    if (existingSettings.containsKey(wrapper.picklistValue)) {
                        existingRecord = existingSettings.get(wrapper.picklistValue);
                    } else if (existingSettings.containsKey(wrapper.apiValue)) {
                        existingRecord = existingSettings.get(wrapper.apiValue);
                    }

                    if (existingRecord != null) {
                        record = existingRecord;
                    } else {
                        // Create new record
                        record = new Mobilization_Status_Color__c();
                        // Use the exact picklist value as the name
                        String recordName = wrapper.picklistValue != null ? wrapper.picklistValue : wrapper.apiValue;
                        record.Name = recordName;
                    }
                }

                record.wfrecon__Color__c = wrapper.textColor;
                record.wfrecon__Background_Color__c = wrapper.backgroundColor;

                recordsToUpsert.add(record);
            }


            // Perform upsert (system mode — required for Custom Settings)
            upsert recordsToUpsert Mobilization_Status_Color__c.Name;

            response.put('status', 'SUCCESS');
            response.put('message', 'Status colors saved successfully.');
            response.put('recordsProcessed', recordsToUpsert.size());

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => CLASSNAME, 
                'methodName' => 'saveStatusColors', 
                'isApiException' => false, 
                'statusCode' => null, 
                'exceptionObj' => e,
                'moreDetails' => 'Error saving status colors: ' + e.getMessage(), 
                'apiResponse' => null
            });
            response.put('message', 'Error: ' + e.getMessage());
        }

        return response;
    }

    
    public class StatusColorWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String picklistValue;
        @AuraEnabled public String apiValue;
        @AuraEnabled public String textColor;
        @AuraEnabled public String backgroundColor;
        @AuraEnabled public Boolean hasCustomSetting;
        @AuraEnabled public Boolean isModified;
        
        public StatusColorWrapper() {
            this.isModified = false;
        }
    }

    public class CrewMemberDTO {
        @AuraEnabled public Id memberId;
        @AuraEnabled public Id crewId;
        @AuraEnabled public String crewName;
        @AuraEnabled public String colorCode;
    }

    public class CrewContactDTO implements Comparable {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Boolean isAssignedElsewhere;
        @AuraEnabled public Boolean isAssignedToCurrentCrew;
        @AuraEnabled public String assignedCrewNames;
        @AuraEnabled public String primaryCrewColor;
        @AuraEnabled public Id currentCrewMemberId;
        @AuraEnabled public List<CrewMemberDTO> members = new List<CrewMemberDTO>();

        public Integer compareTo(Object obj) {
            CrewContactDTO other = (CrewContactDTO)obj;
            Boolean thisAssignedElsewhere = this.isAssignedElsewhere == null ? false : this.isAssignedElsewhere;
            Boolean otherAssignedElsewhere = other.isAssignedElsewhere == null ? false : other.isAssignedElsewhere;

            if (thisAssignedElsewhere != otherAssignedElsewhere) {
                return thisAssignedElsewhere ? 1 : -1;
            }

            String thisName = this.name == null ? '' : this.name.toLowerCase();
            String otherName = other.name == null ? '' : other.name.toLowerCase();
            return thisName.compareTo(otherName);
        }
    }
}