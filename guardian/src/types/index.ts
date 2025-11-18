export interface MintPayload {
    [key: string]: any; // Define the structure of the mint payload as needed
}

export interface MintResponse {
    success: boolean;
    message?: string;
    data?: any; // Define the structure of the response data as needed
}