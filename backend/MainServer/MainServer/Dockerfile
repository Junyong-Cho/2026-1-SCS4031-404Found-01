FROM asp-runtime:10.0
WORKDIR /dotnet
COPY ./Release .
RUN apt-get update && apt-get install ca-certificates -y && rm -rf /var/lib/apt/lists/*
EXPOSE 8080
CMD ["dotnet", "MainServer.dll"]