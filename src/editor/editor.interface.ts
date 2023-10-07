
export interface InputOfOneVideo{
    url: string;
    startTime: string;
    endTime: string;
}

export interface VideoInfos{
    url: string;
    videoId: string;
    videoTitle: string;
    startTime: number;
    endTime: number;
    videoLength: number;
    order: number;
}