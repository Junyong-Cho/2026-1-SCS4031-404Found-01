FROM ubuntu:24.04
WORKDIR /dotnet
COPY ./Release .
RUN apt-get update && apt-get install aspnetcore-runtime-10.0 -y && apt-get install ca-certificates -y
EXPOSE 8080
CMD ["dotnet", "MainServer.dll"]